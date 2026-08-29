/**
 * PWA installation prompt lifecycle and Window Controls Overlay theme synchronization.
 */

interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let installPrompt: BeforeInstallPromptEvent | undefined
const listeners = new Set<() => void>()

window.addEventListener('beforeinstallprompt', event => {
	event.preventDefault()
	installPrompt = event as BeforeInstallPromptEvent
	listeners.forEach(listener => listener())
})

window.addEventListener('appinstalled', () => {
	installPrompt = undefined
	listeners.forEach(listener => listener())
})

/** Whether the browser offered installation (installable, not yet installed). */
export function canInstall(): boolean {
	return installPrompt !== undefined
}

/** Open the browser's install dialog from a user gesture. */
export async function promptInstall(): Promise<void> {
	const prompt = installPrompt
	installPrompt = undefined
	listeners.forEach(listener => listener())
	await prompt?.prompt()
}

/** Subscribe to install prompt availability changes. Returns an unsubscriber. */
export function onInstallAvailabilityChange(listener: () => void): () => void {
	listeners.add(listener)
	return () => listeners.delete(listener)
}

/** Synchronize `<meta name="theme-color">` with live `--color-background` for Window Controls Overlay. */
export function syncThemeColor(): void {
	const meta = document.querySelector('meta[name="theme-color"]')
	if (!meta) {
		return
	}
	const apply = () => {
		const probe = document.createElement('div')
		probe.style.cssText = 'display: none; background-color: var(--color-background)'
		document.documentElement.appendChild(probe)
		meta.setAttribute('content', getComputedStyle(probe).backgroundColor)
		probe.remove()
	}
	apply()
	matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply)
}
