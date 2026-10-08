import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { consola } from 'consola'
import { linesOf, parseChangelog } from '../src/features/about/Changelog.ts'
import { ReleaseContributor, ReleaseNotes } from '../src/features/about/ReleaseNotes.ts'

// Cuts a release: bumps the version, regenerates the changelog and the captures, commits, and on a yes tags and pushes,
// which `release.yml` and `docker.yml` pick up. A minor ships with its notes (releases/<minor>/README.md): without a
// titled one the cut stops after writing a scaffold. Usage: npm run release [version]

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const run = (command: string) => execSync(command, { cwd: rootDir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] }).trim()
const show = (command: string) => execSync(command, { cwd: rootDir, stdio: 'inherit' })
const yes = async (question: string) => /^y(es)?$/i.test((await rl.question(question)).trim())

/** The notes a minor's folder holds, read and written as a file. */
class NotesFile {
	readonly path: string
	readonly minor: string

	constructor(minor: string) {
		this.minor = minor
		this.path = path.join(rootDir, 'releases', minor, 'README.md')
	}

	get relative() {
		return path.relative(rootDir, this.path).replaceAll('\\', '/')
	}

	get exists() {
		return fs.existsSync(this.path)
	}

	read() {
		return ReleaseNotes.parse(fs.readFileSync(this.path, 'utf8'))
	}

	write(notes: ReleaseNotes) {
		fs.mkdirSync(path.dirname(this.path), { recursive: true })
		fs.writeFileSync(this.path, notes.markdown)
	}

	/** The unreleased features as highlight stubs, and no title, which keeps the release from being cut until the notes are written. */
	scaffold() {
		const unreleased = parseChangelog(run('npx git-cliff --unreleased --strip all')).find(section => section.version === 'unreleased')
		const features = unreleased?.categories.filter(category => category.type === 'features').flatMap(linesOf).map(line => line.subject) ?? []
		const highlights = (features.length ? features.slice(0, 5) : ['The first highlight'])
			.map(subject => `## ${subject}\nA paragraph or two in the reader's words.\n\n![What the capture shows](capture-name)\n\nDocs: [Page](../../docs/page.md)\n`)
		this.write(ReleaseNotes.parse(`---\ntitle: \n---\nTwo or three sentences on what ${this.minor} is about.\n\n${highlights.join('\n')}`))
	}
}

class Cut {
	static async of(input: string | undefined) {
		const current = (JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')) as { version: string }).version
		consola.info(`Current version: ${current}`)
		const version = (input ?? await rl.question(`Enter release version (current: ${current}): `)).trim().replace(/^v/, '')
		if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
			throw new Error(`Invalid SemVer version: "${version}"`)
		}
		return new Cut(version)
	}

	readonly version: string

	constructor(version: string) {
		this.version = version
	}

	get tag() {
		return `v${this.version}`
	}

	get isMinor() {
		return ReleaseNotes.isMinorRelease(this.version)
	}

	get isPreRelease() {
		return this.version.includes('-')
	}

	get notesFile() {
		return new NotesFile(ReleaseNotes.minorOf(this.version))
	}

	/** The authors of every commit since the previous tag, or of all of them before the first. */
	get authors() {
		let previous: string | undefined
		try {
			previous = execSync('git describe --tags --abbrev=0 --match v*', { cwd: rootDir, encoding: 'utf8', stdio: 'pipe' }).trim()
		} catch {
			previous = undefined
		}
		return run(`git log ${previous ? `${previous}..` : ''}HEAD --format=%an%x1f%ae`).split('\n').filter(Boolean)
			.map(line => line.split('\x1f'))
			.map(([name = '', email = '']) => ReleaseContributor.ofCommit(name, email))
	}

	/** Whether the tree and the tag allow a cut, asking about uncommitted changes. */
	async allowed() {
		const status = run('git status --porcelain')
		if (status) {
			consola.warn(`Working directory has uncommitted changes:\n${status}`)
			if (!await yes('Continue anyway? (y/N): ')) {
				return false
			}
		}
		if (run('git tag -l').split('\n').map(tag => tag.trim()).includes(this.tag)) {
			consola.error(`Tag ${this.tag} already exists in git repository.`)
			return false
		}
		return true
	}

	/** A minor's notes, or nothing once a scaffold or a complaint has been written for them. A patch has none. */
	notes() {
		if (!this.isMinor) {
			return undefined
		}
		const file = this.notesFile
		if (!file.exists) {
			file.scaffold()
			consola.warn(`${file.relative} did not exist. A scaffold was written from the unreleased changelog: give it a title and its highlights, then run the release again.`)
			return undefined
		}
		const notes = file.read()
		if (!notes.title) {
			consola.error(`${file.relative} has no title yet. Write the notes, then run the release again.`)
			return undefined
		}
		return notes
	}

	/** The version, the changelog and the captures, then the commit that carries them. */
	commit(notes: ReleaseNotes | undefined) {
		show(`npm version ${this.version} --no-git-tag-version`)
		consola.info(`Generating CHANGELOG.md for ${this.tag}...`)
		show(`npm run changelog -- --tag ${this.tag}`)
		consola.info(`Capturing the screenshots for ${this.tag}...`)
		show('npm run screenshots')
		const files = ['package.json', 'package-lock.json', 'CHANGELOG.md', 'cliff.toml', 'assets/screenshots']
		if (notes) {
			const file = this.notesFile
			// The build the screenshots just made is this release's: its own scenes are shot now, the rest borrowed from the docs.
			consola.info(`Completing the captures of ${file.minor}...`)
			show(`node scripts/capture-release.ts ${file.minor} --no-build`)
			// Everyone whose commit is in the release joins its Contributors list; anyone named there by hand stays.
			const complete = notes.withContributors(this.authors)
			// A pre-release keeps the notes a draft: their date is the day the minor ships.
			file.write(this.isPreRelease ? complete : complete.withDate(new Date().toLocaleDateString('en-CA')))
			files.push(`releases/${file.minor}`)
		}
		consola.info('Creating release commit...')
		show(`git add ${files.join(' ')}`)
		show(`git commit -m "release: ${this.tag}"`)
		consola.success(`Created release commit for ${this.tag}.`)
	}

	async push() {
		const branch = run('git branch --show-current') || 'main'
		if (!await yes(`\nTag "${this.tag}" and push to origin/${branch}? (y/N): `)) {
			consola.info(`\nSkipped tagging and pushing. The commit 'release: ${this.tag}' was created locally. When ready, tag and push with:`)
			consola.info(`  git tag ${this.tag}`)
			consola.info(`  git push origin ${branch} ${this.tag}`)
			return
		}
		show(`git tag ${this.tag}`)
		show(`git push origin ${branch} ${this.tag}`)
		consola.success(`\n🎉 Release ${this.tag} pushed successfully! GitHub Actions will create the release and Docker build.`)
	}
}

try {
	const cut = await Cut.of(process.argv[2])
	if (await cut.allowed()) {
		const notes = cut.notes()
		if (!cut.isMinor || notes) {
			consola.start(`Preparing release ${cut.tag}...`)
			cut.commit(notes)
			await cut.push()
		}
	}
} catch (error) {
	consola.error(error)
	process.exitCode = 1
} finally {
	rl.close()
}
