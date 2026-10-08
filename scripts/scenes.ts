/// <reference types="node" />
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { type Clip, type Devtools, reducedMotion, rootDir, screenshot, type Theme } from './capture.ts'
import { encodeFilm, Recording } from './film.ts'

// What a release's `releases/<minor>/scenes.ts` is written with. Importing the file registers its scenes, the way a test
// file registers its tests: `still('plan-detail', async context => …)` and `film('plan-task', { language: 'fa' }, …)`.
// A scene is named after the capture its notes use (`![alt](plan-task)`) and says only how to get there and what to
// keep; the theme, the language (the app's and the sample calendar's), the clock and the files are the runner's.

export interface SceneContext {
	browser: Devtools
	/** The staged app, ending in a slash. */
	origin: string
	theme: Theme
	language: string
	/** Loads the app fresh in the scene's theme and language. */
	open(options?: { availability?: boolean }): Promise<void>
	/** A sample entry's English heading as the sample calendar writes it in the scene's language. */
	text(english: string): string
}

export interface SceneOptions {
	/** The app's language, and the sample calendar's, for this scene. English by default. */
	language?: string
}

const registered = new Map<string, Scene>()

export abstract class Scene {
	/** The scenes registered so far, by capture name. */
	static get all(): ReadonlyMap<string, Scene> {
		return registered
	}

	abstract readonly extension: 'webp' | 'mp4'
	readonly name: string
	readonly language: string

	constructor(name: string, options: SceneOptions) {
		this.name = name
		this.language = options.language ?? 'en'
		registered.set(name, this)
	}

	file(theme: Theme) {
		return `${this.name}-${theme}.${this.extension}`
	}

	/** Shoots the scene in the context's theme and language into `file`. */
	abstract make(context: SceneContext, file: string): Promise<void>
}

export class Still extends Scene {
	override readonly extension = 'webp'
	/** Gets the app to the picture and returns the part of the window to keep, or nothing for all of it. */
	private readonly shoot: (context: SceneContext) => Promise<Clip | undefined>

	constructor(name: string, options: SceneOptions, shoot: Still['shoot']) {
		super(name, options)
		this.shoot = shoot
	}

	override async make(context: SceneContext, file: string) {
		await reducedMotion(context.browser, true)
		await toWebp(await screenshot(context.browser, await this.shoot(context)), file)
	}
}

export class Film extends Scene {
	override readonly extension = 'mp4'
	/** Gets the app to the start and plays the gesture into the recording `record()` hands out. */
	private readonly shoot: (context: SceneContext & { record(clip?: Clip): Recording }) => Promise<void>

	constructor(name: string, options: SceneOptions, shoot: Film['shoot']) {
		super(name, options)
		this.shoot = shoot
	}

	override async make(context: SceneContext, file: string) {
		const frames = fs.mkdtempSync(path.join(rootDir, 'data/.frames-'))
		try {
			await reducedMotion(context.browser, false)
			await this.shoot({ ...context, record: clip => new Recording(context.browser, frames, context.theme, clip) })
			encodeFilm(frames, file)
			// Its first frame as a still beside it: what GitHub shows of the film, and the film's poster until it plays.
			await toWebp(path.join(frames, '0000.png'), file.replace(/\.mp4$/, '.webp'))
		} finally {
			fs.rmSync(frames, { recursive: true, force: true })
		}
	}
}

/** A web-sized still: 1800 wide at most, like the docs' captures. */
export function toWebp(png: Buffer | string, file: string) {
	return sharp(png).resize({ width: 1800, withoutEnlargement: true }).webp({ quality: 90 }).toFile(file)
}

function spread<Shoot>(optionsOrShoot: SceneOptions | Shoot, shoot: Shoot | undefined): [SceneOptions, Shoot] {
	return typeof optionsOrShoot === 'function' ? [{}, optionsOrShoot as Shoot] : [optionsOrShoot as SceneOptions, shoot!]
}

export function still(name: string, shoot: Still['shoot']): Still
export function still(name: string, options: SceneOptions, shoot: Still['shoot']): Still
export function still(name: string, optionsOrShoot: SceneOptions | Still['shoot'], shoot?: Still['shoot']) {
	return new Still(name, ...spread(optionsOrShoot, shoot))
}

export function film(name: string, shoot: Film['shoot']): Film
export function film(name: string, options: SceneOptions, shoot: Film['shoot']): Film
export function film(name: string, optionsOrShoot: SceneOptions | Film['shoot'], shoot?: Film['shoot']) {
	return new Film(name, ...spread(optionsOrShoot, shoot))
}
