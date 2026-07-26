import { command, Command } from './Command.js'

@command()
export class WeekView extends Command {
	heading = t('Week View')
	icon = 'columns-3'
	keywords = t('switch')
	keys = ['w']
	group = 'views'
	execute() { this.calendar.setView('week') }
}

@command()
export class MonthView extends Command {
	heading = t('Month View')
	icon = 'calendar-days'
	keywords = t('switch grid')
	keys = ['m']
	group = 'views'
	execute() { this.calendar.setView('month') }
}

@command()
export class YearView extends Command {
	heading = t('Year View')
	icon = 'rows-3'
	keywords = t('switch grid')
	keys = ['y']
	group = 'views'
	execute() { this.calendar.setView('year') }
}
