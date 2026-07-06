/**
 * The PWA install affordance: Chromium fires `beforeinstallprompt` when the app is installable and NOT
 * already installed — capturing that event IS the "should we offer an install button" signal (it never
 * fires when installed, and never in browsers without install prompts, so the button self-hides
 * everywhere it makes no sense). The captured event is the only way to open the install dialog later,
 * from a user gesture. Installing is worth offering prominently: an installed mitra gets its own
 * taskbar/home-screen presence and — the real prize — its notifications attribute to "Mitra" with the
 * app icon instead of the browser's name.
 */

interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let installPrompt: BeforeInstallPromptEvent | undefined
const listeners = new Set<() => void>()

window.addEventListener('beforeinstallprompt', event => {
	event.preventDefault() // suppress Chromium's own mini-infobar; the sidebar button is the entry point
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

/** Open the browser's install dialog. Call from a user gesture. */
export async function promptInstall(): Promise<void> {
	const prompt = installPrompt
	installPrompt = undefined // a captured event is single-use, whatever the outcome
	listeners.forEach(listener => listener())
	await prompt?.prompt()
}

/** Notify on availability changes, so a button can appear/disappear. Returns the unsubscriber. */
export function onInstallAvailabilityChange(listener: () => void): () => void {
	listeners.add(listener)
	return () => listeners.delete(listener)
}
