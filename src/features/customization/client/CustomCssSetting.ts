import { setting } from '#features/settings/client/Setting.js'
import { CustomCss } from './CustomCss.js'
import { StylesheetSetting } from './StylesheetSetting.js'

/** The account's own CSS over Mitra's, on every device it signs in on. */
@setting()
export class CustomCssSetting extends StylesheetSetting {
	readonly stylesheet = CustomCss.account
	readonly heading = t('Custom CSS')
	readonly icon = 'paintbrush'
	readonly keywords = t('CustomCssSetting.Keywords')
	readonly page = 'general'

	override get hint() {
		return t('Restyle Mitra with your own CSS, on every device you sign in on. An update can change what your rules target.')
	}
}
