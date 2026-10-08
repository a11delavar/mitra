/// <reference types="node" />
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ReleaseNotes } from '../src/features/about/ReleaseNotes.ts'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Copies every release's notes into `dist/releases/<minor>/` for the app's What's New, and the captures of the releases
 * this build is: a tag's own minor, and past a tag the release in development too. Older releases read as text, so the
 * image carries at most two releases' pictures.
 */
export function writeReleaseAssets(version: string) {
	const source = path.join(rootDir, 'releases')
	const target = path.join(rootDir, 'dist/releases')
	fs.rmSync(target, { recursive: true, force: true })
	const folders = !fs.existsSync(source) ? [] : fs.readdirSync(source)
		.filter(name => /^\d+\.\d+$/.test(name) && fs.existsSync(path.join(source, name, 'README.md')))
	const notes = new Map(folders.map(name => [name, ReleaseNotes.parse(fs.readFileSync(path.join(source, name, 'README.md'), 'utf8'))]))
	const tagged = /^v?\d+\.\d+\.\d+(-[\w.]+)?$/.test(version) && !version.endsWith('-dirty')
	// The next release, not one planned beyond it.
	const draft = folders.filter(name => !notes.get(name)!.date).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))[0]
	// A tag carries its own release; a build past one (the `:dev` image) carries that release and the draft above it.
	const carried = new Set([ReleaseNotes.minorOf(version), ...!tagged && draft ? [draft] : []])
	for (const name of folders) {
		fs.mkdirSync(path.join(target, name), { recursive: true })
		fs.copyFileSync(path.join(source, name, 'README.md'), path.join(target, name, 'README.md'))
		if (carried.has(name)) {
			for (const file of fs.readdirSync(path.join(source, name)).filter(file => /\.(webp|mp4)$/.test(file))) {
				fs.copyFileSync(path.join(source, name, file), path.join(target, name, file))
			}
		}
	}
}
