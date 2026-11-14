import { Stylesheet } from '#features/customization/Stylesheet.js'

/**
 * What holds for everyone on the instance, which its administrators set: kept in `State` under {@link InstanceSettings.key},
 * only what deviates from the defaults, and read by the browser with the rest of what the instance says of itself.
 */
export class InstanceSettings {
	static readonly key = 'instance-settings'

	/** A stylesheet over Mitra's for everyone, beneath each account's own. */
	customCss?: string
	/** Whether it is worn, stored only when it is turned off. */
	customCssEnabled?: boolean

	/** Drops unknown keys and values out of range, and answers nothing when nothing is left. */
	static sanitize(input: unknown): InstanceSettings | undefined {
		const incoming = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>
		const settings: InstanceSettings = {}
		const css = Stylesheet.sanitize(incoming.customCss)
		if (css) {
			settings.customCss = css
		}
		if (incoming.customCssEnabled === false) {
			settings.customCssEnabled = false
		}
		return Object.keys(settings).length ? settings : undefined
	}
}
