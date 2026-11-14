import { instanceStorage, userStorage, type SettingStorage } from '#features/settings/client/Setting.js'
import { PageState } from '#infrastructure/http/PageState.js'

/**
 * A stylesheet over Mitra's, the instance's or the account's, worn as an adopted sheet. Adopted sheets cascade after every
 * stylesheet in the document, the account's after the instance's, so it wins where both set the same thing, and both outrank
 * Mitra's own, which sit in a layer. Never a `<style>`: its text never becomes markup.
 */
export class CustomCss {
	/** What an administrator wrote for everyone on the instance. */
	static readonly instance = new CustomCss(instanceStorage('customCss'), instanceStorage('customCssEnabled'))

	/** What the account wrote for itself. */
	static readonly account = new CustomCss(userStorage('customCss'), userStorage('customCssEnabled'))

	/** `?css=off`: this load wears neither stylesheet, the way back from a rule that hid the way back. */
	static readonly suspended = new URLSearchParams(location.search).get('css') === 'off'

	/** Wears both as stored; called once the account and the instance are known, before the calendar first renders. */
	static wearStored() {
		CustomCss.instance.wearStored()
		CustomCss.account.wearStored()
	}

	static {
		if (!CustomCss.suspended) {
			document.adoptedStyleSheets = [...document.adoptedStyleSheets, CustomCss.instance.sheet, CustomCss.account.sheet]
		}
	}

	private readonly sheet = new CSSStyleSheet()

	private constructor(private readonly text: SettingStorage<string>, readonly enabled: SettingStorage<boolean>) { }

	/** The stylesheet as kept. */
	get css() {
		return this.text.read() ?? ''
	}

	get worn() {
		return this.enabled.read() !== false
	}

	/** Wears `text` over Mitra, or nothing. */
	wear(text = '') {
		this.sheet.replaceSync(text)
	}

	wearStored() {
		this.wear(this.worn ? this.css : '')
	}

	/** Shows `css` as it is typed, while the stylesheet is worn. */
	preview(css: string) {
		if (this.worn) {
			this.wear(css)
		}
	}

	async save(css: string) {
		try {
			await this.text.write(css.trim() ? css : undefined)
		} catch (error) {
			console.error('Saving the custom CSS failed:', error)
		}
		this.wearStored()
		PageState.changed()
	}
}
