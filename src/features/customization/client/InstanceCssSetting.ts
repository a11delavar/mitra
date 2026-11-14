import { setting } from '#features/settings/client/Setting.js'
import { session } from '#infrastructure/http/PageSession.js'
import { CustomCss } from './CustomCss.js'
import { StylesheetSetting } from './StylesheetSetting.js'

/** CSS over Mitra's for everyone on the instance, beneath each account's own; only where people sign in, as else the account's is the same. */
@setting()
export class InstanceCssSetting extends StylesheetSetting {
	readonly stylesheet = CustomCss.instance
	readonly heading = t('Custom CSS for everyone')
	readonly icon = 'paintbrush'
	readonly keywords = t('InstanceCssSetting.Keywords')
	readonly page = 'administration'

	override get applies() {
		return !!session.instance.signIn && !!session.user?.administers
	}

	override get hint() {
		return t('Restyle Mitra for everyone on this server. Each person\'s own CSS comes after it, so theirs wins.')
	}
}
