/// <reference types="node" />
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { consola } from 'consola'
import { type Clip, type Devtools, type Theme } from './capture.ts'

// Films for the release notes. A film runs on Chrome's virtual clock, advanced one frame at a time between pointer
// moves, so the pointer's path, the app's transitions and the frame rate come out the same on any machine, however
// loaded, and only a change in the app changes the film. The frames become an MP4 through ffmpeg, which the machine
// cutting a release needs installed. `MOTION_TRACE=1 CONSOLA_LEVEL=4` logs every step of every frame.

// Chrome draws on a 60 Hz vsync even on the virtual clock, so a frame is two of those: one in which the input is
// processed, one in which the screenshot is drawn. A step of any other length lands the draw past its end now and then.
const vsyncMs = 1000 / 60
const fps = 30
const frameMs = 2 * vsyncMs

export type Point = { x: number, y: number }

/** Eases in and out, so the pointer leaves and arrives like a hand would. */
const ease = (t: number) => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2

/**
 * A pointer drawn into the page: headless Chrome paints none, and a film without one shows things moving by themselves.
 * Its tip is the pointer's position. The arrow is the Windows one with a stub of a tail, inverted per theme, and it never
 * changes, not even on a press: a disc behind the tip either lightened the dark ground into a glow or drew the eye.
 */
const cursorScript = (theme: Theme) => `
	const cursor = document.createElement('div')
	cursor.id = 'capture-cursor'
	cursor.innerHTML = \`
		<style>
			#capture-cursor { position: fixed; left: 0; top: 0; z-index: 2147483647; pointer-events: none; }
			#capture-cursor svg { display: block; overflow: visible; }
			/* No edge: one soft black shadow sets the arrow off from whatever it crosses. Denser on the dark theme, where black on a dark ground barely shows. */
			#capture-cursor .arrow { filter: drop-shadow(0 0.6px 1.4px rgb(0 0 0 / ${theme === 'dark' ? 0.7 : 0.4})); }
		</style>
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
			<path class="arrow" d="M1.2 1.2v16.6l4.4-3.8 2.6 5.5 2.7-1.3-2.5-5.4h5.8z" fill="${theme === 'dark' ? '#ffffff' : '#0a0a0a'}" />
		</svg>\`
	document.body.append(cursor)
	const nudge = document.createElement('div')
	nudge.id = 'capture-nudge'
	Object.assign(nudge.style, { position: 'fixed', left: '0', top: '0', width: '1px', height: '1px', opacity: '0', pointerEvents: 'none', willChange: 'transform' })
	document.body.append(nudge)
`

/** A film being shot: the pointer's moves, presses and holds, each filmed frame by frame into `dir`. */
export class Recording {
	private frames = 0
	private readonly page: Devtools
	private readonly dir: string
	private readonly clip: Clip | undefined
	private readonly theme: Theme

	// Node strips types but rewrites nothing, so no parameter properties.
	constructor(page: Devtools, dir: string, theme: Theme, clip?: Clip) {
		this.page = page
		this.dir = dir
		this.theme = theme
		this.clip = clip
	}

	async start() {
		fs.mkdirSync(this.dir, { recursive: true })
		await this.page.evaluate(cursorScript(this.theme))
		await this.page.send('Emulation.setVirtualTimePolicy', { policy: 'pause' })
		// Endless animations (the dial of a task in progress) ran on real time until here and stand at a random phase, and even
		// from time zero their frames sample a fraction of a frame apart between runs. A film is about a gesture, so they stand
		// still at their first pose. Finite ones (transitions) keep running on the virtual clock; scroll-driven ones have no time to set.
		await this.page.evaluate(`
			for (const animation of document.getAnimations()) {
				if (animation.timeline instanceof ScrollTimeline || animation.timeline instanceof ViewTimeline) {
					continue
				}
				if (animation.effect?.getComputedTiming().endTime === Infinity) {
					animation.pause()
					animation.currentTime = 0
				}
			}
		`)
	}

	/**
	 * Lets the page's clock run for one frame. Plain `advance`: the policy that waits for pending fetches never moves,
	 * because the app's event stream is a fetch that never ends.
	 */
	private async advance(budget = frameMs) {
		const expired = this.page.once('Emulation.virtualTimeBudgetExpired')
		await this.page.send('Emulation.setVirtualTimePolicy', { policy: 'advance', budget })
		await expired
	}

	/** Runs the clock, without filming, until the page shows what `predicate` looks for: a save answered by the server lands between two frames. */
	async until(predicate: string, what: string, seconds = 10) {
		for (let i = 0; i < seconds * fps; i++) {
			if (await this.page.evaluate<boolean>(predicate)) {
				return
			}
			await this.advance()
		}
		throw new Error(`Timed out waiting for ${what}`)
	}

	private trace(step: string) {
		if (process.env.MOTION_TRACE) {
			consola.debug(`frame ${this.frames} ${step}`)
		}
	}

	private async pointer(pointer: Point) {
		this.trace('pointer')
		await this.page.evaluate(`document.getElementById('capture-cursor').style.transform = 'translate(${pointer.x - 1.2}px, ${pointer.y - 1.2}px)'`)
	}

	/**
	 * One frame in two halves of the clock. The pointer is drawn and its event sent, and the first half lets Chrome
	 * process it (an input is acknowledged only once a frame has been drawn, which happens on the virtual clock alone,
	 * so awaiting it on a standing clock waits forever). Then the screenshot is requested and the second half draws it,
	 * for the same reason: requested on a standing clock, a screenshot never comes. Requested before the first half it
	 * would show the frame before the input, and the ghost would trail the pointer.
	 */
	private async step(pointer: Point, event?: object) {
		await this.pointer(pointer)
		this.trace(event ? `input ${(event as { type: string }).type}` : 'frame')
		const acknowledged = event ? this.page.send('Input.dispatchMouseEvent', { ...event, x: pointer.x, y: pointer.y }) : Promise.resolve()
		await this.advance(vsyncMs)
		await acknowledged
		this.trace('capture')
		// Nothing changes in the second half, and Chrome draws nothing for nothing, screenshot or not: an invisible element moves so that it does.
		await this.page.evaluate(`
			const nudge = document.getElementById('capture-nudge')
			nudge.style.transform = nudge.style.transform ? '' : 'translateZ(0)'
		`)
		const shot = this.page.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, ...(this.clip ? { clip: { ...this.clip, scale: 1 } } : {}) })
		await this.advance(vsyncMs)
		// The answer comes once the PNG is encoded, which takes real time, so the draw gets a moment before it counts as
		// missed. A draw that did miss its vsync gets the next one, at most a few times: the trace says when.
		const encoded = (grace: number) => Promise.race([shot.then(() => true), new Promise<boolean>(resolve => setTimeout(() => resolve(false), grace))])
		for (let extra = 0; extra < 4 && !await encoded(800); extra++) {
			this.trace(`capture waits a vsync (${extra + 1})`)
			await this.advance(vsyncMs)
		}
		// Rarely, right after a save lands, no vsync frees the draw. Real time does; the clock stops again as soon as the frame is in.
		if (!await encoded(800)) {
			this.trace('capture waits on real time')
			await this.page.send('Emulation.setVirtualTimePolicy', { policy: 'advance' })
			await shot
			await this.page.send('Emulation.setVirtualTimePolicy', { policy: 'pause' })
		}
		const { data } = await shot
		fs.writeFileSync(path.join(this.dir, `${String(this.frames++).padStart(4, '0')}.png`), Buffer.from(data, 'base64'))
	}

	/** Keeps the pointer still at `point` for `seconds`, whether or not the button is down. */
	async hold(point: Point, seconds: number) {
		for (let i = 0; i < Math.round(seconds * fps); i++) {
			await this.step(point)
		}
	}

	/** Moves the pointer from `from` to `to` over `seconds`, dragging when pressed. */
	async move(from: Point, to: Point, seconds: number, pressed = false) {
		const count = Math.max(1, Math.round(seconds * fps))
		for (let i = 1; i <= count; i++) {
			const t = ease(i / count)
			const point = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
			await this.step(point, { type: 'mouseMoved', button: pressed ? 'left' : 'none', buttons: pressed ? 1 : 0 })
		}
	}

	async press(point: Point) {
		await this.step(point, { type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1 })
	}

	async release(point: Point) {
		await this.step(point, { type: 'mouseReleased', button: 'left', buttons: 0, clickCount: 1 })
	}

	async stop() {
		await this.page.send('Emulation.setVirtualTimePolicy', { policy: 'advance' })
		await this.page.evaluate('document.getElementById("capture-cursor")?.remove(); document.getElementById("capture-nudge")?.remove()')
		return this.frames
	}
}

/** Where the middle of what the expression finds is. */
export async function middleOf(page: Devtools, find: string): Promise<Point> {
	const point = await page.evaluate<Point | null>(`
		const element = ${find}
		if (!element) {
			return null
		}
		const { x, y, width, height } = element.getBoundingClientRect()
		return { x: x + width / 2, y: y + height / 2 }
	`)
	if (!point) {
		throw new Error(`Nothing found: ${find}`)
	}
	return point
}

/** Runs ffmpeg and hands back what it reports (on stderr, where it writes everything). */
function ffmpeg(args: Array<string>, what: string): string {
	const result = spawnSync('ffmpeg', ['-y', ...args], { encoding: 'utf8' })
	if (result.error || result.status !== 0) {
		throw new Error(`ffmpeg could not ${what}. Is it installed and on PATH? ${result.error?.message ?? result.stderr.trim().split('\n').at(-1)}`)
	}
	return result.stderr
}

/**
 * Two recordings of the same scene differ in a few pixels by one colour level (raster noise), which the encoder turns
 * into different bytes. So a new film replaces the old one only when some frame has more than a few pixels that moved
 * by more than a couple of levels: a shadow softened is dozens of them, noise is three by one. Counted on a quarter-size
 * grey rendering of both films, frame by frame.
 */
function differs(fresh: string, output: string): boolean {
	const frames = (file: string) => {
		const result = spawnSync('ffmpeg', ['-loglevel', 'error', '-i', file, '-vf', 'scale=450:-2', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 256 * 1024 * 1024 })
		if (result.status !== 0) {
			throw new Error(`ffmpeg could not decode ${file}: ${result.stderr.toString().trim()}`)
		}
		return result.stdout
	}
	const [a, b] = [frames(fresh), frames(output)]
	if (a.length !== b.length) {
		return true
	}
	const frameSize = 450 * 282
	for (let frame = 0; frame * frameSize < a.length; frame++) {
		let moved = 0
		for (let i = frame * frameSize; i < Math.min(a.length, (frame + 1) * frameSize); i++) {
			if (Math.abs(a[i]! - b[i]!) > 4 && ++moved > 8) {
				return true
			}
		}
	}
	return false
}

/** Encodes the frames in `framesDir` into `output`, 1800 pixels wide like the stills, unless the film there already shows the same. */
export function encodeFilm(framesDir: string, output: string) {
	const name = path.basename(output)
	const fresh = path.join(framesDir, name)
	ffmpeg([
		'-loglevel', 'error',
		// No creation time or encoder stamp in the file, so the same frames are the same bytes.
		'-fflags', '+bitexact', '-flags', '+bitexact',
		'-framerate', String(fps), '-i', path.join(framesDir, '%04d.png'),
		'-vf', 'scale=1800:-2:flags=lanczos',
		// CRF 16, not the default range: at 20 the small white arrow on a dark ground rang a light fringe into its own shadow.
		'-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-movflags', '+faststart',
		fresh,
	], `encode ${name}`)
	if (fs.existsSync(output) && !differs(fresh, output)) {
		consola.info(`${name} unchanged`)
		return
	}
	fs.copyFileSync(fresh, output)
	consola.success(`${name} (${Math.round(fs.statSync(output).size / 1024)} KB)`)
}
