import { html } from '@a11d/lit'
import { ToggleSetting, type SettingStorage } from '#features/settings/client/Setting.js'
import { type CustomCss } from './CustomCss.js'

/** A stylesheet over Mitra's, typed into the box beneath the row; the switch puts it away without losing it. */
export abstract class StylesheetSetting extends ToggleSetting {
	abstract readonly stylesheet: CustomCss

	readonly fallback = true

	protected readonly storage: SettingStorage<boolean> = {
		read: () => this.stylesheet.enabled.read(),
		write: value => {
			this.stylesheet.wear(value === false ? '' : this.stylesheet.css)
			return this.stylesheet.enabled.write(value)
		},
	}

	// Turning nothing on or off is no verb.
	override get verbs() {
		return this.stylesheet.css ? super.verbs : []
	}

	override get details() {
		return html`<mitra-custom-css-editor label=${this.heading} .stylesheet=${this.stylesheet}></mitra-custom-css-editor>`
	}
}
