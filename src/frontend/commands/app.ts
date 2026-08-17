import { command, Command } from './Command.js'
import { DialogIntegration } from '../DialogIntegration.js'
import { DialogAbout } from '../DialogAbout.js'
import { DialogKeyboardShortcuts } from '../DialogKeyboardShortcuts.js'

@command()
export class ToggleSidebar extends Command {
	heading = t('Toggle Sidebar')
	icon = 'panel-left'
	keywords = t('ToggleSidebar.Keywords')
	group = undefined
	keys = []
	execute() { this.calendar.toggleSidebar() }
}

@command()
export class KeyboardShortcuts extends Command {
	heading = t('Keyboard Shortcuts')
	icon = 'keyboard'
	keywords = t('KeyboardShortcuts.Keywords')
	keys = ['?']
	group = 'general'
	execute() { return new DialogKeyboardShortcuts().confirm() }
}

@command()
export class AddIntegration extends Command {
	heading = t('Add Integration')
	icon = 'plug'
	keywords = t('AddIntegration.Keywords')
	group = undefined
	keys = []
	execute() { return new DialogIntegration({}).confirm() }
}

// The version string itself is a keyword, so typing what the sidebar's brand row shows finds these.

@command()
export class About extends Command {
	heading = t('About')
	icon = 'info'
	keywords = `${t('About.Keywords')} ${mitra.version}`
	group = undefined
	keys = []
	execute() { return new DialogAbout().confirm() }
}

@command()
export class WhatsNew extends Command {
	heading = t('What\'s New')
	icon = 'sparkles'
	keywords = `${t('WhatsNew.Keywords')} ${mitra.version}`
	group = undefined
	keys = []
	execute() { return new DialogAbout().confirm() }
}

@command()
export class CopyVersion extends Command {
	heading = t('Copy Version')
	icon = 'copy'
	keywords = `${t('CopyVersion.Keywords')} ${mitra.version}`
	group = undefined
	keys = []
	execute() { return navigator.clipboard.writeText(`Mitra ${mitra.version}`) }
}
