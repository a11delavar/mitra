/**
 * OS launch integration. The PWA manifest (scripts/indexHtml.ts) registers mitra as a handler for
 * .ics files and the webcal: protocol; with `launch_handler: focus-existing`, a launch reaches the
 * already-running window as LaunchParams on `window.launchQueue` instead of navigating it. A cold
 * start instead navigates to the handler URL, whose `?subscribe=` parameter is consumed at boot, so
 * a cold protocol launch surfaces on BOTH paths, which {@link observeLaunches} deduplicates.
 */

interface LaunchParams {
	readonly targetURL?: string
	readonly files?: ReadonlyArray<FileSystemFileHandle>
}

interface LaunchQueue {
	setConsumer(consumer: (params: LaunchParams) => void): void
}

export interface LaunchHandlers {
	subscribe(url: string): void
	files(files: ReadonlyArray<File>): void
}

/** Extracts the subscription address a protocol launch encoded into the handler URL. */
export function subscribeUrlOf(target: string): string | undefined {
	try {
		return new URL(target).searchParams.get('subscribe')?.trim() || undefined
	} catch {
		return undefined
	}
}

let bootConsumedUrl: string | undefined

/** Reads the protocol-launch parameter of a cold start, before the page canonicalizes its URL.
 * Deliberately does not strip it: `PageCalendar` is the sole URL writer, and its first canonical
 * write drops the parameter along with everything else it does not own. */
export function consumeSubscribeParameter(): string | undefined {
	return bootConsumedUrl = subscribeUrlOf(location.href)
}

/** Consumes queued and future launches (focus-existing warm launches, and cold-start file opens). */
export function observeLaunches(handlers: LaunchHandlers) {
	(window as { launchQueue?: LaunchQueue }).launchQueue?.setConsumer(async params => {
		const url = !params.targetURL ? undefined : subscribeUrlOf(params.targetURL)
		if (url && url !== bootConsumedUrl) {
			handlers.subscribe(url)
		}
		bootConsumedUrl = undefined
		const files = await Promise.all([...params.files ?? []].map(handle => handle.getFile()))
		if (files.length) {
			handlers.files(files)
		}
	})
}

/** Accepts .ics files dropped onto the window, the in-browser counterpart to OS file launches.
 * Every file drop is claimed (never handed to the browser, which would navigate away from the app);
 * non-calendar files are simply ignored. */
export function observeFileDrops(handler: (files: ReadonlyArray<File>) => void) {
	window.addEventListener('dragover', event => {
		if ([...event.dataTransfer?.items ?? []].some(item => item.kind === 'file')) {
			event.preventDefault()
		}
	})
	window.addEventListener('drop', event => {
		if (![...event.dataTransfer?.files ?? []].length) {
			return
		}
		event.preventDefault()
		const files = [...event.dataTransfer!.files].filter(file => file.type === 'text/calendar' || file.name.toLowerCase().endsWith('.ics'))
		if (files.length) {
			handler(files)
		}
	})
}
