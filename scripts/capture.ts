/// <reference types="node" />
import { execSync, spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { consola } from 'consola'
import sharp from 'sharp'

// The capture harness the stills (screenshots.ts) and the films (motion.ts) share: a staged build of the app with the
// sample calendar, headless Chrome driven over CDP with real input, a clock stood still on one Thursday, and the
// helpers that find, open and crop what a scene shows. `stage()` runs a scene inside all of that.

const here = path.dirname(fileURLToPath(import.meta.url))
export const rootDir = path.resolve(here, '..')
export const outDir = path.join(rootDir, 'assets/screenshots')

/**
 * Where a language's docs captures go: English's are committed in `assets/screenshots/`, every other language's in a
 * gitignored folder of their own beneath it, shot again by the website's build (they change with every look of the app,
 * and committed per language they would grow the history several times over).
 */
export const outDirOf = (language: string) => language === 'en' ? outDir : path.join(outDir, language)

/** The UI's own text in `language`: the app's dictionaries are keyed by the English text, as the sample's are. */
export function appText(english: string, language: string): string {
	const dictionary = path.join(rootDir, 'src/infrastructure/i18n', `${language}.json`)
	if (language === 'en' || !fs.existsSync(dictionary)) {
		return english
	}
	const translated = (JSON.parse(fs.readFileSync(dictionary, 'utf8')) as Record<string, unknown>)[english]
	return typeof translated === 'string' ? translated : english
}

export const viewport = { width: 1440, height: 900, scale: 2 }

/** Crops from where the sidebar ends, so small contexts show the app near its real size. */
export const details = {
	week: { width: 960, height: 620 }, // the layered scene: wide and short
	view: { width: 860, height: 900 }, // the views grid: read top to bottom
	sidebar: { width: 860, height: 460 }, // the sidebar, with the week beside it for context
	surface: { width: 860 }, // an open entry, with the calendar around it
}

/** Chrome's own headless build; override with CHROME_PATH. */
const chromeCandidates = [
	process.env.CHROME_PATH,
	'C:/Program Files/Google/Chrome/Application/chrome.exe',
	'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
	'/usr/bin/google-chrome',
	'/usr/bin/chromium',
	'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
]

export type Theme = 'light' | 'dark'
export type View = 'week' | 'month' | 'year' | 'timeline' | 'table'

/** Each layer hides the app and shows one part again; `visibility` keeps every frame on the same pixels. */
const captureCss = `
	/* A blinking caret stood in some captures of a focused field and not in others. */
	* { caret-color: transparent !important; }

	html[data-capture] mitra-application { visibility: hidden; }
	html[data-capture] :is(mitra-entry-details, mitra-command-palette, dialog) { display: none !important; }

	/* A base-select <select> paints through an ancestor's visibility: hidden; opacity moves nothing. */
	html[data-capture]:not([data-capture='frame']) :is(mitra-sidebar, main > header) {
		opacity: 0 !important;
	}

	html[data-capture='frame'] mitra-application { visibility: visible; }
	html[data-capture='frame'] :is(mitra-entry-segment, mitra-entry-connections) { visibility: hidden; }

	/* Columns scrolled under the sticky time axis would show through a layer that has no axis. */
	html[data-capture]:not([data-capture='frame']) mitra-days {
		clip-path: inset(0 0 0 var(--capture-axis, 0px));
	}

	html[data-capture='events'] mitra-entry-segment:not([data-status]) { visibility: visible; }
	html[data-capture='tasks'] mitra-entry-segment[data-status] { visibility: visible; }
	html[data-capture='links'] mitra-entry-connections { visibility: visible; }

	/* The availability guide's captures are about the windows; links between entries only distract there. */
	html[data-scene='availability'] mitra-entry-connections { visibility: hidden; }
`

export const layers = ['frame', 'events', 'tasks', 'links'] as const

// ── A very small CDP client ──────────────────────────────────────────────────────────────────

export class Devtools {
	private nextId = 1
	private readonly pending = new Map<number, { resolve: (value: any) => void, reject: (error: Error) => void }>()
	private readonly listeners = new Map<string, Set<(params: any) => void>>()
	private readonly socket: WebSocket
	sessionId: string | undefined

	private constructor(socket: WebSocket) {
		this.socket = socket
		socket.addEventListener('message', event => {
			const message = JSON.parse(String(event.data))
			if (message.method) {
				for (const listener of this.listeners.get(message.method) ?? []) {
					listener(message.params)
				}
				return
			}
			const entry = this.pending.get(message.id)
			if (!entry) {
				return
			}
			this.pending.delete(message.id)
			message.error ? entry.reject(new Error(message.error.message)) : entry.resolve(message.result)
		})
	}

	/** The next event of the given method. Armed before the command that causes it, or the event is gone by the time it is awaited. */
	once<T = any>(method: string): Promise<T> {
		return new Promise(resolve => {
			const listeners = this.listeners.get(method) ?? new Set<(params: any) => void>()
			this.listeners.set(method, listeners)
			const listener = (params: T) => {
				listeners.delete(listener)
				resolve(params)
			}
			listeners.add(listener)
		})
	}

	static async connect(url: string) {
		const socket = new WebSocket(url)
		await new Promise<void>((resolve, reject) => {
			socket.addEventListener('open', () => resolve(), { once: true })
			socket.addEventListener('error', () => reject(new Error(`Cannot reach DevTools at ${url}`)), { once: true })
		})
		return new Devtools(socket)
	}

	send<T = any>(method: string, params: object = {}): Promise<T> {
		const id = this.nextId++
		this.socket.send(JSON.stringify({ id, method, params, ...(this.sessionId ? { sessionId: this.sessionId } : {}) }))
		return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }))
	}

	/** Evaluates an expression in the page and returns its (awaited) value. */
	async evaluate<T = unknown>(expression: string): Promise<T> {
		const { result, exceptionDetails } = await this.send('Runtime.evaluate', {
			expression: `(async () => { ${expression} })()`,
			awaitPromise: true,
			returnByValue: true,
		})
		if (exceptionDetails) {
			throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text)
		}
		return result.value as T
	}

	close() {
		this.socket.close()
	}
}

// ── Processes ────────────────────────────────────────────────────────────────────────────────

export function freePort() {
	return new Promise<number>((resolve, reject) => {
		const server = net.createServer()
		server.on('error', reject)
		server.listen(0, '127.0.0.1', () => {
			const { port } = server.address() as net.AddressInfo
			server.close(() => resolve(port))
		})
	})
}

export async function waitFor(probe: () => Promise<boolean>, what: string, attempts = 100) {
	for (let attempt = 0; attempt < attempts; attempt++) {
		if (await probe().catch(() => false)) {
			return
		}
		await new Promise(resolve => setTimeout(resolve, 200))
	}
	throw new Error(`Timed out waiting for ${what}`)
}

/** Recreates the Demo integration every capture shows, so no leftover edits or hidden calendars reach the images. */
export async function seedSampleCalendar(origin: string) {
	const api = (route: string, init?: RequestInit) => fetch(`${origin}api/${route}`, { headers: { 'Content-Type': 'application/json' }, ...init })
	for (const integration of await (await api('integrations')).json() as Array<{ id: string, type: string }>) {
		if (integration.type === 'demo') {
			await api(`integrations/${integration.id}`, { method: 'DELETE' })
		}
	}
	const sources = await (await api('integrations/sources', { method: 'POST', body: JSON.stringify({ id: crypto.randomUUID(), type: 'demo' }) })).json()
	const { id } = await (await api('integrations', { method: 'POST', body: JSON.stringify({ type: 'demo', sources }) })).json()
	await waitFor(async () => {
		const demo = (await (await api('integrations')).json() as Array<{ id: string, sources: Array<{ importedAt?: string }> }>).find(integration => integration.id === id)
		return !!demo?.sources.length && demo.sources.every(source => source.importedAt)
	}, 'the sample calendar')
}

/**
 * Stages the build beside an empty database: the server reads `data/` relative to its bundle, and the developer's own
 * database would put their calendars in the images. Externals still resolve upward to the checkout's node_modules.
 */
export function stageServer(stageDir: string) {
	fs.mkdirSync(path.join(stageDir, 'out/server'), { recursive: true })
	fs.mkdirSync(path.join(stageDir, 'data'))
	fs.copyFileSync(path.join(rootDir, 'out/server/server.mjs'), path.join(stageDir, 'out/server/server.mjs'))
	fs.copyFileSync(path.join(rootDir, 'CHANGELOG.md'), path.join(stageDir, 'CHANGELOG.md'))
	fs.symlinkSync(path.join(rootDir, 'dist'), path.join(stageDir, 'dist'), 'junction')
}

/**
 * Every capture happens on one fixed Thursday at 10:20, in one zone and language: the sample week is laid out around
 * it, and a moving date repainted every image on every run, so only what changed changes in the history. The language
 * is European English (`en-150`): weeks from Monday, the day before the month, 24-hour times, and no country's own.
 */
export const capturedAt = { moment: Date.parse('2026-10-01T10:20:00+02:00'), timeZone: 'Europe/Berlin', locale: 'en-150' }

/** The locale a language's captures stand in: English's European one, any other language as itself. */
export const localeOf = (language: string) => language === 'en' ? capturedAt.locale : language

/**
 * Replaces `Date`'s now with `now`, an expression of the real one. Nothing reads `Temporal.Now`, so this is the whole clock.
 * A function sharing `Date`'s prototype, so `instanceof` holds both ways and subclasses (`DateTime`) construct through it.
 */
export function clockAt(now: string) {
	return `(() => {
		const RealDate = Date
		const now = () => ${now}
		function ShiftedDate(...args) {
			return new.target ? Reflect.construct(RealDate, args.length ? args : [now()], new.target) : new RealDate(now()).toString()
		}
		ShiftedDate.prototype = RealDate.prototype
		Object.setPrototypeOf(ShiftedDate, RealDate)
		ShiftedDate.now = now
		globalThis.Date = ShiftedDate
	})()`
}

/** What the stand-in geocoder answers to any search: a city with the places a search for it turns up, and its namesake. */
const geneva = [
	{ name: 'Geneva', state: 'Geneva', country: 'Switzerland', osm_key: 'place', osm_value: 'city' },
	{ name: 'Geneva Airport', city: 'Le Grand-Saconnex', state: 'Geneva', country: 'Switzerland', osm_key: 'aeroway', osm_value: 'aerodrome' },
	{ name: 'Genève-Cornavin', city: 'Geneva', country: 'Switzerland', osm_key: 'railway', osm_value: 'station' },
	{ name: 'Palais des Nations', street: 'Avenue de la Paix', city: 'Geneva', country: 'Switzerland', osm_key: 'tourism', osm_value: 'attraction' },
	{ name: 'Parc des Bastions', city: 'Geneva', country: 'Switzerland', osm_key: 'leisure', osm_value: 'park' },
	{ name: 'Geneva', state: 'Illinois', country: 'United States', osm_key: 'place', osm_value: 'town' },
]

/** Stands in for Photon, so the location capture shows the same places on every run and asks nobody outside. */
export function startGeocoder(port: number) {
	const body = JSON.stringify({ type: 'FeatureCollection', features: geneva.map(properties => ({ type: 'Feature', properties })) })
	return http.createServer((_request, response) => {
		response.writeHead(200, { 'Content-Type': 'application/json' })
		response.end(body)
	}).listen(port, '127.0.0.1')
}

export function startServer(port: number, stageDir: string, clock: string, geocoder: string) {
	const child = spawn(process.execPath, ['--import', `data:text/javascript,${encodeURIComponent(clock)}`, path.join(stageDir, 'out/server/server.mjs')], {
		cwd: stageDir,
		env: { ...process.env, TZ: capturedAt.timeZone, MITRA_DEV: 'true', MITRA_PORT: String(port), MITRA_UPDATE_CHECK: 'off', MITRA_PHOTON_URL: geocoder },
		stdio: ['ignore', 'pipe', 'pipe'],
	})
	child.stderr.on('data', chunk => consola.debug(String(chunk).trim()))
	return child
}

export function startChrome(port: number, profileDir: string, locale = capturedAt.locale) {
	const executable = chromeCandidates.find(candidate => candidate && fs.existsSync(candidate))
	if (!executable) {
		throw new Error('No Chrome found. Set CHROME_PATH to a Chrome or Chromium binary.')
	}
	consola.info(`Chrome: ${executable}`)
	return spawn(executable, [
		'--headless=new',
		`--remote-debugging-port=${port}`,
		`--user-data-dir=${profileDir}`,
		'--hide-scrollbars',
		'--no-first-run',
		'--no-default-browser-check',
		'--disable-extensions',
		'--force-device-scale-factor=1',
		'--force-color-profile=srgb',
		'--font-render-hinting=none',
		`--lang=${locale}`,
		'about:blank',
	], { stdio: ['ignore', 'ignore', 'ignore'] })
}

// ── Capturing ────────────────────────────────────────────────────────────────────────────────

export type Clip = { x: number, y: number, width: number, height: number }

/** The page as it rests, as a PNG. */
export async function screenshot(page: Devtools, clip?: Clip, transparent = false): Promise<Buffer> {
	// A transition caught halfway (a progress ring filling in) differed run to run; endless ones (spinners) never settle.
	await page.evaluate(`
		const settling = document.getAnimations().filter(animation => animation.effect?.getComputedTiming().endTime !== Infinity && animation.playState === 'running' && !(animation.timeline instanceof ScrollTimeline || animation.timeline instanceof ViewTimeline))
		await Promise.all(settling.map(animation => animation.finished.catch(() => undefined)))
		await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
	`)
	await page.send('Emulation.setDefaultBackgroundColorOverride',
		transparent ? { color: { r: 0, g: 0, b: 0, a: 0 } } : {})
	const { data } = await page.send('Page.captureScreenshot', {
		format: 'png',
		optimizeForSpeed: false,
		// `clip.scale` multiplies the device scale factor; 1 keeps crops at 2×.
		...(clip ? { clip: { ...clip, scale: 1 } } : {}),
	})
	return Buffer.from(data, 'base64')
}

/**
 * A still for the docs, into `assets/screenshots/<file>.webp` (or its language's folder): lossless, so it is the PNG
 * Chrome took, at half its size.
 */
export async function capture(page: Devtools, file: string, transparent: boolean, clip?: Clip, language = 'en') {
	const output = path.join(outDirOf(language), `${file}.webp`)
	fs.mkdirSync(path.dirname(output), { recursive: true })
	fs.writeFileSync(output, await sharp(await screenshot(page, clip, transparent)).webp({ lossless: true, effort: 6 }).toBuffer())
	consola.success(path.relative(outDir, output).replaceAll('\\', '/'))
}

/** Stills stand under reduced motion, so endless animations hold one pose; a film lets them run. */
export async function reducedMotion(page: Devtools, reduced: boolean) {
	await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }] })
}

/**
 * Writes the sample calendar in `language` and waits until it is rebuilt. Where the Demo integration cannot take a
 * language yet, the rebuild is simply English again. A scene that changes it changes it back.
 */
export async function sampleLanguage(origin: string, language: string) {
	type Demo = { id: string, type: string, credentials?: Record<string, unknown>, sources: Array<{ importedAt?: string }> }
	const api = (route: string, init?: RequestInit) => fetch(`${origin}api/${route}`, { headers: { 'Content-Type': 'application/json' }, ...init })
	const demo = () => api('integrations').then(response => response.json() as Promise<Array<Demo>>).then(list => list.find(integration => integration.type === 'demo')!)
	const before = await demo()
	await api(`integrations/${before.id}`, { method: 'PUT', body: JSON.stringify({ ...before, credentials: { ...before.credentials, language } }) })
	await api(`integrations/${before.id}/reimport`, { method: 'POST' })
	await waitFor(async () => {
		const after = await demo()
		return after.sources.length > 0 && after.sources.every(source => source.importedAt)
	}, `the sample calendar in ${language}`)
}

/** A sample entry's heading as the sample calendar writes it in `language`: the demo's dictionary keys are the English text. */
export function sampleText(english: string, language: string): string {
	const dictionary = path.join(rootDir, 'src/integrations/demo/i18n', `${language}.json`)
	if (language === 'en' || !fs.existsSync(dictionary)) {
		return english
	}
	const translated = (JSON.parse(fs.readFileSync(dictionary, 'utf8')) as Record<string, unknown>)[english]
	return typeof translated === 'string' ? translated : english
}

/** A padded crop around the open dialog, for the docs' reading column. */
export async function aroundOpenDialog(page: Devtools, padding: number): Promise<Clip> {
	// `mitra-dialog` keeps its <dialog> in a shadow root and is itself `display: contents`.
	const rect = await page.evaluate<Clip | null>(`
		const shadowed = [...document.querySelectorAll('mitra-dialog')]
			.map(host => host.shadowRoot?.querySelector('dialog'))
		const element = [...document.querySelectorAll('dialog'), ...shadowed].find(dialog => dialog?.open)
		if (!element) {
			return null
		}
		const { x, y, width, height } = element.getBoundingClientRect()
		return { x, y, width, height }
	`)
	if (!rect || rect.width === 0) {
		throw new Error('No open dialog to crop around')
	}
	const x = Math.max(0, Math.round(rect.x - padding))
	const y = Math.max(0, Math.round(rect.y - padding))
	return {
		x,
		y,
		width: Math.min(viewport.width - x, Math.round(rect.width + padding * 2)),
		height: Math.min(viewport.height - y, Math.round(rect.height + padding * 2)),
	}
}

/** A crop of the given size, starting where the sidebar ends. */
export async function detail(page: Devtools, size: { width: number, height: number }): Promise<Clip> {
	const left = await page.evaluate<number>(`
		const main = document.querySelector('mitra-page-calendar main')
		return Math.round(main.getBoundingClientRect().x)
	`)
	return { x: left, y: 0, ...size }
}

/**
 * Loads the app fresh in the given theme and language and waits until the calendar has drawn its entries. The language
 * goes through storage, as the theme does: a `?lang=` parameter is gone by the reload, since the page rewrites its URL
 * from its own state. Every open states it, so one scene's Persian never reaches the next. English is stored as the
 * captures' full locale: a bare language would take its region from the browser, and with it the week's first day.
 */
export async function open(page: Devtools, origin: string, theme: Theme, { availability = false, language = 'en' } = {}) {
	await page.send('Page.navigate', { url: origin })
	await waitFor(() => page.evaluate<boolean>('return !!document.querySelector("mitra-page-calendar")'), 'the app to boot')
	await showAvailability(page, availability)
	await page.evaluate(`
		localStorage.setItem('Mitra.Appearance.Theme', ${JSON.stringify(JSON.stringify(theme))})
		localStorage.setItem('Localizer.Language', ${JSON.stringify(JSON.stringify(localeOf(language)))})
		// Zoom the day grid past "the whole day at once" so entries read at their working size,
		// what the app opens on at a comfortable window, rather than the squeezed 24-hour fit.
		localStorage.setItem('Mitra.WeekZoom', '2')
	`)
	await page.send('Page.reload')
	await waitFor(() => page.evaluate<boolean>('return document.querySelectorAll("mitra-entry-segment").length > 0'), 'entries to render')
	await settle(page)
	await page.evaluate(`
		const style = document.createElement('style')
		style.id = 'capture'
		style.textContent = ${JSON.stringify(captureCss)}
		document.head.append(style)
		await document.fonts.ready
	`)
	const inter = await page.evaluate<boolean>('return document.fonts.check("500 14px Inter Variable")')
	if (!inter) {
		consola.warn('Inter did not load, so captures will use a fallback face and will not match the site.')
	}
}

/** Entries keep arriving after a view switch widens the fetch, so settle on a count, not a delay. */
export async function show(page: Devtools, view: View) {
	await page.evaluate(`
		const calendar = document.querySelector('mitra-page-calendar')
		calendar.setView(${JSON.stringify(view)})
		await calendar.updateComplete
	`)
	await settle(page)
}

/**
 * Waits until the rendered entries (chips, or the table's rows) are there and hold steady, and every scroller has come to
 * rest: a view still arriving (the year strip finishing its snap) stood a few pixels elsewhere from run to run.
 */
export async function settle(page: Devtools) {
	await page.evaluate(`
		const count = () => document.querySelectorAll('mitra-entry-segment, mitra-table-row').length
		const scrolls = () => [...document.querySelectorAll('*')]
			.filter(element => element.scrollLeft || element.scrollTop)
			.map(element => element.scrollLeft + ':' + element.scrollTop)
			.join()
		const state = () => count() + '|' + scrolls()
		let previous = ''
		let stable = 0
		for (let attempt = 0; attempt < 60 && (stable < 4 || count() === 0); attempt++) {
			await new Promise(resolve => setTimeout(resolve, 250))
			const current = state()
			stable = current === previous ? stable + 1 : 0
			previous = current
		}
		await document.querySelector('mitra-page-calendar').updateComplete
	`)
}

/**
 * Parks the day grid on the working hours, half an hour short of the first entry (06:30, ahead of
 * the 07:00 routine): the all-day lane is sticky, so a grid parked exactly on the first entry clips
 * its chips against the lane and the two read as one crowded band.
 */
export async function scrollToMorning(page: Devtools) {
	await page.evaluate(`
		const scroller = document.querySelector('mitra-days')
		if (scroller) {
			const day = scroller.querySelector('mitra-day .entries') ?? scroller.querySelector('.axis')
			const dayHeight = day ? day.getBoundingClientRect().height : scroller.scrollHeight
			scroller.scrollTop = Math.min(scroller.scrollHeight, (6.5 * 60 / 1440) * dayHeight)
		}
		await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
	`)
}

/** Real key events, never `open = true`: a synthetic open can show what the keyboard cannot reach. */
export async function press(page: Devtools, key: string, code: string, keyCode: number, modifiers = 0) {
	const base = { key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, modifiers }
	await page.send('Input.dispatchKeyEvent', { ...base, type: 'keyDown', text: key.length === 1 ? key : undefined })
	await page.send('Input.dispatchKeyEvent', { ...base, type: 'keyUp' })
	await page.evaluate('await new Promise(resolve => setTimeout(resolve, 500))')
}

/** A real click in the middle of whatever the expression finds, holding CDP's `modifiers` (Alt 1, Ctrl 2, Meta 4, Shift 8). */
export async function click(page: Devtools, find: string, modifiers = 0) {
	const point = await page.evaluate<{ x: number, y: number } | null>(`
		const element = ${find}
		if (!element) {
			return null
		}
		const { x, y, width, height } = element.getBoundingClientRect()
		return { x: x + width / 2, y: y + height / 2 }
	`)
	if (!point) {
		throw new Error(`Nothing to click: ${find}`)
	}
	for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
		await page.send('Input.dispatchMouseEvent', { type, ...point, modifiers, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: 1 })
	}
	// Parked in the corner, or whatever ends up under the pointer is captured in its hover state.
	await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0, button: 'none' })
	await page.evaluate('await new Promise(resolve => setTimeout(resolve, 400))')
}

/** Location is empty around today; hiding it, as a reader would, brings Participants into the crop. */
export async function hideTableLocation(page: Devtools, language = 'en') {
	await click(page, `[...document.querySelectorAll("mitra-table .header .column .label")].find(label => label.textContent.trim() === ${JSON.stringify(appText('Location', language))})`)
	await click(page, `[...document.querySelectorAll("mitra-table-column-menu mitra-menu-item")].find(item => item.textContent.trim() === ${JSON.stringify(appText('Hide column', language))})`)
}

/** A crop the given width around the element, as tall as it plus padding, kept inside the viewport. */
export async function around(page: Devtools, find: string, width: number, padding: number): Promise<Clip> {
	const rect = await page.evaluate<Clip | null>(`
		const element = ${find}
		if (!element) {
			return null
		}
		const { x, y, width, height } = element.getBoundingClientRect()
		return { x, y, width, height }
	`)
	if (!rect || rect.width === 0) {
		throw new Error(`Nothing to crop around: ${find}`)
	}
	const height = Math.min(viewport.height, Math.round(rect.height + padding * 2))
	return {
		x: Math.min(viewport.width - width, Math.max(0, Math.round(rect.x + rect.width / 2 - width / 2))),
		y: Math.min(viewport.height - height, Math.max(0, Math.round(rect.y - padding))),
		width,
		height,
	}
}

/**
 * The opening week's last day is cut off, so on the day of the week that puts what a capture needs there, the strip
 * first scrolls it into view, with `room` to spare after it.
 */
export async function bringIntoView(page: Devtools, elements: string, room = 24) {
	await page.evaluate(`
		const main = document.querySelector('mitra-page-calendar main').getBoundingClientRect()
		const elements = ${elements}
		const shown = element => element.getBoundingClientRect().x >= main.x && element.getBoundingClientRect().right + ${room} <= innerWidth
		const next = elements.find(element => element.getBoundingClientRect().x >= main.x)
		if (!elements.some(shown) && next) {
			document.querySelector('mitra-days').scrollBy({ left: next.getBoundingClientRect().right + ${room} - innerWidth })
			await new Promise(resolve => setTimeout(resolve, 600))
		}
	`)
}

/** Opens an entry's editor from its chip on screen; the week also renders its neighbours off-screen. */
export async function openChip(page: Devtools, heading: string) {
	await bringIntoView(page, `[...document.querySelectorAll('mitra-entry-segment')].filter(segment => segment.textContent.includes(${JSON.stringify(heading)}))`)
	await click(page, `[...document.querySelectorAll('mitra-entry-segment')].find(segment => {
		const { x, right } = segment.getBoundingClientRect()
		return segment.textContent.includes(${JSON.stringify(heading)}) && x >= document.querySelector('mitra-page-calendar main').getBoundingClientRect().x && right <= innerWidth
	})`)
	await editorOpened(page, heading)
}

/** Opens an entry's editor by searching for it in the command palette, wherever it is dated. */
export async function openFound(page: Devtools, heading: string) {
	await press(page, ...keys.slash())
	await page.send('Input.insertText', { text: heading })
	const result = `[...document.querySelectorAll('mitra-command-palette mitra-option')].find(option => option.querySelector('.heading')?.textContent.trim() === ${JSON.stringify(heading)})`
	await waitFor(() => page.evaluate<boolean>(`return !!${result}`), `"${heading}" in the palette`)
	await click(page, result)
	await editorOpened(page, heading)
}

/** Picks a zone in the open time zone picker by typing part of its city. The picker draws its field and list in its shadow root. */
export async function pickZone(page: Devtools, city: string) {
	const picker = '[...document.querySelectorAll("mitra-time-zone-picker")].find(picker => picker.hasAttribute("open"))?.shadowRoot'
	await waitFor(() => page.evaluate<boolean>(`return !!${picker}?.querySelector("mitra-search-field")`), 'the time zone picker')
	await click(page, `${picker}.querySelector("mitra-search-field")`)
	await page.send('Input.insertText', { text: city })
	const option = `[...(${picker}?.querySelectorAll('mitra-option') ?? [])].find(option => option.querySelector('.city')?.textContent.includes(${JSON.stringify(city)}))`
	await waitFor(() => page.evaluate<boolean>(`return !!${option}`), `${city} in the time zone picker`)
	await click(page, option)
}

/** Wednesday's work, the sample's one labelled window: its place, Home office, is all it says. */
export const homeOfficeIn = (language: string) => `[...document.querySelectorAll('mitra-availability-segment')].find(segment => {
	const label = segment.querySelector('.label')
	const { x, right } = label?.getBoundingClientRect() ?? { x: -1, right: Infinity }
	return label?.textContent === ${JSON.stringify(sampleText('Home office', language))} && x >= document.querySelector('mitra-page-calendar main').getBoundingClientRect().x && right <= innerWidth
})`

/**
 * Tuesday to Thursday, with their headers, from 08:00 to 18:30: working hours and study time as they usually are, and
 * Wednesday's home office between them. The grid is parked so 08:00 meets the sticky header, which keeps the morning routine out.
 */
export async function aroundHomeOffice(page: Devtools, language = 'en'): Promise<Clip> {
	const homeOffice = homeOfficeIn(language)
	await waitFor(() => page.evaluate<boolean>(`return !!${homeOffice}`), 'the Home office window')
	const rect = await page.evaluate<Clip>(`
		const scroller = document.querySelector('mitra-days')
		const day = ${homeOffice}.closest('mitra-day')
		const entries = () => day.querySelector('.entries').getBoundingClientRect()
		const hour = entries().height / 24
		const sticky = Math.max(...[...scroller.querySelectorAll('[data-chrome]')].map(element => element.getBoundingClientRect().bottom).filter(bottom => bottom < innerHeight / 2))
		scroller.scrollTop += entries().top + 8 * hour - sticky
		await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
		const { x, width } = day.getBoundingClientRect()
		const top = scroller.getBoundingClientRect().top
		return { x: Math.round(x - width), y: Math.round(top), width: Math.round(3 * width), height: Math.round(entries().top + 18.5 * hour - top) }
	`)
	return { ...rect, width: Math.min(rect.width, viewport.width - rect.x) }
}

/** Every capture but the availability guide's shows the calendar with availability off, the setting a reader may not use. */
export async function showAvailability(page: Devtools, shown: boolean) {
	await page.evaluate(`
		await fetch('/api/user/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ settings: ${shown ? '{}' : '{ hideAvailability: true }'} }) })
	`)
}

export async function editorOpened(page: Devtools, heading: string) {
	await waitFor(() => page.evaluate<boolean>(`return !!${openEditor}`), `the editor of "${heading}"`)
	await settle(page)
	// The popover slides in; capture it at rest.
	await page.evaluate('await new Promise(resolve => setTimeout(resolve, 600))')
}

// The details element is `display: contents`; its popover's `.editor` carries the surface.
export const openEditor = 'document.querySelector("mitra-entry-details > mitra-popover[open] > .editor")'

export const sidebarTab = (name: string) => `document.querySelector('mitra-sidebar mitra-tab[name="${name}"]')`

export const keys = {
	slash: () => ['/', 'Slash', 191, 0] as const,
	question: () => ['?', 'Slash', 191, 8] as const,
	comma: () => [',', 'Comma', 188, 2] as const,
	escape: () => ['Escape', 'Escape', 27, 0] as const,
	create: () => ['c', 'KeyC', 67, 0] as const,
}

/** The open editor with a list hanging off it (`hanging`, an expression), padded, kept inside the viewport. */
export async function aroundEditorWith(page: Devtools, hanging: string, padding: number): Promise<Clip> {
	const rect = await page.evaluate<Clip | null>(`
		const boxes = [${openEditor}, ${hanging}]
			.filter(Boolean).map(element => element.getBoundingClientRect()).filter(box => box.width > 0)
		if (boxes.length < 2) {
			return null
		}
		const x = Math.min(...boxes.map(box => box.x)), y = Math.min(...boxes.map(box => box.y))
		return { x, y, width: Math.max(...boxes.map(box => box.right)) - x, height: Math.max(...boxes.map(box => box.bottom)) - y }
	`)
	if (!rect) {
		throw new Error(`Nothing open beside the editor: ${hanging}`)
	}
	const width = details.surface.width
	const height = Math.min(viewport.height, Math.round(rect.height + padding * 2))
	return {
		x: Math.min(viewport.width - width, Math.max(0, Math.round(rect.x + rect.width / 2 - width / 2))),
		y: Math.min(viewport.height - height, Math.max(0, Math.round(rect.y - padding))),
		width,
		height,
	}
}

/** Measured from `.axis`: its `.time` parent is `display: contents` and reports zero. */
export async function measureAxis(page: Devtools) {
	const width = await page.evaluate<number>(`
		const axis = document.querySelector('mitra-days .axis') ?? document.querySelector('mitra-days .all-day-corner')
		return axis ? Math.round(axis.getBoundingClientRect().width) : 0
	`)
	if (!width) {
		throw new Error('No time axis found. The week view must be on screen before capturing layers.')
	}
	await page.evaluate(`document.documentElement.style.setProperty('--capture-axis', '${width}px')`)
}

export async function setLayer(page: Devtools, layer: string | null) {
	await page.evaluate(`
		document.documentElement.toggleAttribute('data-capture', ${JSON.stringify(!!layer)})
		${layer ? `document.documentElement.setAttribute('data-capture', ${JSON.stringify(layer)})` : ''}
		await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
	`)
}

// ── Staging ──────────────────────────────────────────────────────────────────────────────────

export interface StageOptions {
	/** Stills stand under reduced motion, so endless animations hold one pose; a film lets them run. */
	reducedMotion?: boolean
	/** Builds first, stamped with package.json's version: the sidebar prints it, and `git describe` would write `-dirty` into every image. */
	build?: boolean
	/** The language the browser stands in, and the sample calendar is written in. */
	language?: string
}

/** Builds and stages the app with the sample calendar, launches Chrome around `scene`, and takes everything down again. */
export async function stage(scene: (browser: Devtools, origin: string) => Promise<void>, { reducedMotion: reduced = true, build = true, language = 'en' }: StageOptions = {}) {
	const { version } = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')) as { version: string }
	if (build) {
		consola.start(`Building v${version}`)
		execSync('npm run build', { cwd: rootDir, stdio: 'inherit', env: { ...process.env, MITRA_VERSION: `v${version}` } })
	}

	fs.mkdirSync(outDir, { recursive: true })
	const profileDir = fs.mkdtempSync(path.join(rootDir, 'data/.chrome-'))
	const stageDir = fs.mkdtempSync(path.join(rootDir, 'data/.capture-'))

	const appPort = await freePort()
	const debugPort = await freePort()
	const geocoderPort = await freePort()
	const processes = new Array<ChildProcess>()
	const geocoder = startGeocoder(geocoderPort)

	try {
		stageServer(stageDir)
		// The page's clock stands still, so every capture reads 10:20. The server's runs on from there: its sync pacing measures elapsed time.
		const { moment } = capturedAt
		processes.push(startServer(appPort, stageDir, clockAt(`RealDate.now() + ${moment - Date.now()}`), `http://127.0.0.1:${geocoderPort}`))
		const origin = `http://127.0.0.1:${appPort}/`
		await waitFor(async () => (await fetch(`${origin}api/health`)).ok, 'the app server')
		consola.info(`Mitra on ${origin}`)
		await seedSampleCalendar(origin)
		if (language !== 'en') {
			await sampleLanguage(origin, language)
		}

		processes.push(startChrome(debugPort, profileDir, localeOf(language)))
		await waitFor(async () => (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok, 'Chrome')
		const chrome = await (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).json()

		const browser = await Devtools.connect(chrome.webSocketDebuggerUrl)
		const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' })
		const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true })
		browser.sessionId = sessionId

		await browser.send('Page.enable')
		await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: clockAt(String(moment)) })
		await browser.send('Runtime.enable')
		await browser.send('Emulation.setTimezoneOverride', { timezoneId: capturedAt.timeZone })
		await browser.send('Emulation.setLocaleOverride', { locale: localeOf(language) })
		// A still stands under reduced motion: endless motion (the dial of a task in progress) stood at another angle in every run.
		await reducedMotion(browser, reduced)
		await browser.send('Emulation.setDeviceMetricsOverride', {
			width: viewport.width,
			height: viewport.height,
			deviceScaleFactor: viewport.scale,
			mobile: false,
		})

		await scene(browser, origin)
		browser.close()
	} finally {
		for (const child of processes) {
			child.kill()
		}
		geocoder.close()
		// Chrome can hold its profile past the kill; a leftover must never mask the real error.
		await new Promise(resolve => setTimeout(resolve, 500))
		// Unlinked first, so the recursive removal below can never follow it into the real dist/.
		fs.rmSync(path.join(stageDir, 'dist'), { force: true })
		for (const dir of [profileDir, stageDir]) {
			try {
				fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
			} catch {
				consola.debug(`Left behind ${dir}`)
			}
		}
	}
}
