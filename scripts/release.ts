import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { consola } from 'consola'

const here = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(here, '..')
const pkgPath = path.join(rootDir, 'package.json')

function run(command: string): string {
	return execSync(command, { cwd: rootDir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] }).trim()
}

function runInherit(command: string): void {
	execSync(command, { cwd: rootDir, stdio: 'inherit' })
}

async function main() {
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

	try {
		const gitStatus = run('git status --porcelain')
		if (gitStatus) {
			consola.warn('Working directory has uncommitted changes:\n' + gitStatus)
			const proceed = await rl.question('Continue anyway? (y/N): ')
			if (!/^y(es)?$/i.test(proceed.trim())) {
				consola.info('Aborted.')
				return
			}
		}

		const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version: string }
		const currentVersion = pkg.version
		consola.info(`Current version: ${currentVersion}`)

		let targetInput = process.argv[2]
		if (!targetInput) {
			targetInput = await rl.question(`Enter release version (current: ${currentVersion}): `)
		}

		const cleanVersion = targetInput.trim().replace(/^v/, '')
		if (!cleanVersion || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(cleanVersion)) {
			consola.error(`Invalid SemVer version: "${targetInput}"`)
			return
		}

		const tag = `v${cleanVersion}`

		const existingTags = run('git tag -l').split('\n').map(t => t.trim())
		if (existingTags.includes(tag)) {
			consola.error(`Tag ${tag} already exists in git repository.`)
			return
		}

		const branch = run('git branch --show-current') || 'main'
		consola.start(`Preparing release ${tag} on branch ${branch}...`)

		runInherit(`npm version ${cleanVersion} --no-git-tag-version`)

		consola.info(`Generating CHANGELOG.md for ${tag}...`)
		runInherit(`npm run changelog -- --tag ${tag}`)

		consola.info('Creating release commit...')
		runInherit('git add package.json package-lock.json CHANGELOG.md')
		runInherit(`git commit -m "release: ${tag}"`)

		consola.success(`Created release commit for ${tag}.`)

		const answer = await rl.question(`\nTag "${tag}" and push to origin/${branch}? (y/N): `)
		if (/^y(es)?$/i.test(answer.trim())) {
			consola.start(`Tagging ${tag}...`)
			runInherit(`git tag ${tag}`)

			consola.start(`Pushing to origin ${branch} and tag ${tag}...`)
			runInherit(`git push origin ${branch} ${tag}`)

			consola.success(`\n🎉 Release ${tag} pushed successfully! GitHub Actions will create the release and Docker build.`)
		} else {
			consola.info('\nSkipped tagging and pushing.')
			consola.info(`The commit 'release: ${tag}' was created locally. When ready, you can tag and push with:`)
			consola.info(`  git tag ${tag}`)
			consola.info(`  git push origin ${branch} ${tag}`)
		}
	} finally {
		rl.close()
	}
}

main().catch(error => {
	consola.error(error)
	process.exit(1)
})
