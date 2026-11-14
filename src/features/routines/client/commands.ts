import { command, Command } from '#features/commands/Command.js'

@command()
export class ShowRoutines extends Command {
	readonly heading = t('Routines')
	readonly icon = 'repeat'
	readonly keywords = t('ShowRoutines.Keywords')
	readonly keys = []
	readonly group = undefined
	execute() { this.calendar.showRoutines() }
}
