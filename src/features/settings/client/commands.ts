import { command, Command } from '../../commands/Command.js'
import { DialogSettings } from './DialogSettings.js'
import { settings, settingsPage, type Setting, type SettingVerb } from './Setting.js'

@command()
export class OpenSettings extends Command {
	heading = t('Settings')
	icon = 'settings'
	keywords = t('OpenSettings.Keywords')
	group = undefined
	keys = []
	execute() { return new DialogSettings({}).confirm() }
}

// Settings palette commands are derived dynamically based on current values and applicable options.

/** One verb of one setting, executed straight from the palette. */
class ApplySetting extends Command {
	constructor(private readonly setting: Setting<unknown>, private readonly verb: SettingVerb) {
		super()
	}

	get heading() { return this.verb.heading }
	readonly icon = 'sliders-horizontal'
	get keywords() { return `${settingsPage(this.setting.page).title} ${this.setting.heading} ${this.setting.keywords ?? ''}` }
	readonly keys = []
	readonly group = undefined

	override get listedWithoutQuery() { return false }

	override execute() { return this.verb.apply() }
}

/** Opens settings dialog focused on a specific setting. */
class RevealSetting extends Command {
	constructor(private readonly setting: Setting<unknown>) {
		super()
	}

	get heading() { return t('Change ${name}…', { name: this.setting.heading }) }
	readonly icon = 'sliders-horizontal'
	get keywords() { return `${settingsPage(this.setting.page).title} ${this.setting.keywords ?? ''}` }
	readonly keys = []
	readonly group = undefined

	override get listedWithoutQuery() { return false }

	override execute() { return new DialogSettings({ focus: this.setting }).confirm() }
}

/** Builds command palette actions for all applicable settings. */
export function settingCommands(): Array<Command> {
	return settings()
		.filter(setting => setting.applies)
		.flatMap((setting): Array<Command> => setting.verbs.length
			? setting.verbs.map(verb => new ApplySetting(setting, verb))
			: [new RevealSetting(setting)])
}
