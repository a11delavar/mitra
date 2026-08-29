/** Trigger short vibration feedback if supported and permitted. */
export function haptic(durationMs: number) {
	if (typeof navigator.vibrate === 'function' && (navigator.userActivation?.hasBeenActive ?? true)) {
		navigator.vibrate(durationMs)
	}
}
