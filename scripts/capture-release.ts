/// <reference types="node" />
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { consola } from 'consola'
import { open, outDir, rootDir, sampleLanguage, sampleText, stage, type Theme } from './capture.ts'
import { Scene, type SceneContext, toWebp } from './scenes.ts'
import { ReleaseNotes } from '../src/features/about/ReleaseNotes.ts'

// Completes a release's folder with every capture its notes name, in both themes. Its own scenes
// (`releases/<minor>/scenes.ts`, stills and films) are shot into it; any other name is borrowed from the docs' captures
// in `assets/screenshots/`. A capture already in the folder stays as it is, since it shows the release as it shipped:
// name a capture, or pass `--force`, to make it again. The docs' captures are another matter: `npm run screenshots`
// redoes them every time.
//
// Usage: node scripts/capture-release.ts <minor> [capture …] [--force] [--no-build]

const [minor, ...named] = process.argv.slice(2).filter(argument => !argument.startsWith('--'))
const folder = minor ? path.join(rootDir, 'releases', minor) : ''
if (!minor || !fs.existsSync(path.join(folder, 'README.md'))) {
	consola.error('Usage: node scripts/capture-release.ts <minor> [capture …] [--force] [--no-build], for a minor with a releases/<minor>/README.md')
	process.exit(1)
}

const scenesFile = path.join(folder, 'scenes.ts')
if (fs.existsSync(scenesFile)) {
	await import(pathToFileURL(scenesFile).href)
}
const scenes = Scene.all
const notes = ReleaseNotes.parse(fs.readFileSync(path.join(folder, 'README.md'), 'utf8'))
const captures = new Map(notes.highlights.flatMap(highlight => highlight.capture ? [[highlight.capture.name, highlight.capture] as const] : []))
const unknown = named.filter(name => !captures.has(name) && !scenes.has(name))
if (unknown.length) {
	consola.error(`releases/${minor} names no capture ${unknown.join(', ')}.`)
	process.exit(1)
}

const force = process.argv.includes('--force')
const themes: Array<Theme> = ['light', 'dark']
const output = (name: string, theme: Theme) => path.join(folder, (scenes.get(name) ?? captures.get(name))!.file(theme))
/** Named captures are made again; otherwise only what is missing. */
const due = (name: string, theme: Theme) => (!named.length || named.includes(name)) && (force || named.includes(name) || !fs.existsSync(output(name, theme)))
const relative = (file: string) => path.relative(rootDir, file).replaceAll('\\', '/')

// Borrowed from the docs: no browser needed.
for (const name of [...captures.keys()].filter(name => !scenes.has(name))) {
	for (const theme of themes.filter(theme => due(name, theme))) {
		const source = path.join(outDir, `${name}-${theme}.webp`)
		if (!fs.existsSync(source)) {
			throw new Error(`The notes name "${name}", which neither releases/${minor}/scenes.ts shoots nor assets/screenshots has (run npm run screenshots).`)
		}
		await toWebp(source, output(name, theme))
		consola.success(`${relative(output(name, theme))}, from the docs`)
	}
}

// Shot for this release, grouped by language so the sample calendar is rewritten once per language, not once per scene.
const shots = [...scenes.values()]
	.flatMap(scene => themes.map(theme => ({ scene, theme })))
	.filter(({ scene, theme }) => due(scene.name, theme))
	.sort((a, b) => a.scene.language.localeCompare(b.scene.language))

/** The image carries the running release's captures, so every release keeps them under a budget. */
const budget = 2 * 1024 * 1024
function weigh() {
	const bytes = fs.readdirSync(folder).filter(file => /\.(webp|mp4)$/.test(file)).reduce((sum, file) => sum + fs.statSync(path.join(folder, file)).size, 0)
	const megabytes = `${(bytes / 1024 / 1024).toFixed(1)} MB`
	if (bytes > budget) {
		consola.warn(`releases/${minor} holds ${megabytes} of captures, over the ${budget / 1024 / 1024} MB the image carries per release: fewer or shorter films, or tighter crops.`)
	} else {
		consola.info(`releases/${minor} holds ${megabytes} of captures.`)
	}
}

if (!shots.length) {
	consola.success(`releases/${minor} has every capture its notes name.`)
	weigh()
	process.exit(0)
}

await stage(async (browser, origin) => {
	let sample = 'en'
	let touched = false
	for (const { scene, theme } of shots) {
		// Every shot starts from the sample calendar as seeded: a film's drag saves, and the next take found nothing left to drag.
		if (touched || scene.language !== sample) {
			consola.info(`The sample calendar, rebuilt in ${scene.language}`)
			await sampleLanguage(origin, scene.language)
			sample = scene.language
		}
		touched = true
		const context: SceneContext = {
			browser,
			origin,
			theme,
			language: scene.language,
			open: options => open(browser, origin, theme, { ...options, language: scene.language }),
			text: english => sampleText(english, scene.language),
		}
		const file = output(scene.name, theme)
		consola.start(relative(file))
		await scene.make(context, file)
		consola.success(path.basename(file))
	}
}, { build: !process.argv.includes('--no-build') })
weigh()
