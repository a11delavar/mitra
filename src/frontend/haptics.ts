/**
 * A short confirmation buzz, where the device has one. It is the physical half of a gesture's feedback
 * and never the whole of it — iOS Safari implements no Vibration API at all — so whatever this
 * accompanies must stand on its own visually.
 *
 * Gated on a user activation because Chrome otherwise refuses the call and logs an intervention warning
 * (DevTools touch emulation never grants one). `vibrate` returns false rather than throwing, so the
 * guard is about keeping the console clean; it can never interrupt a gesture.
 */
export function haptic(durationMs: number) {
	if (typeof navigator.vibrate === 'function' && (navigator.userActivation?.hasBeenActive ?? true)) {
		navigator.vibrate(durationMs)
	}
}
