import { command, Command } from './Command.js'

@command()
export class WeekView extends Command {
	heading = t('Week View')
	icon = 'columns-3'
	keywords = t('WeekView.Keywords')
	keys = ['w']
	group = 'views'
	execute() { this.calendar.setView('week') }
}

@command()
export class MonthView extends Command {
	heading = t('Month View')
	icon = 'calendar-days'
	keywords = t('MonthView.Keywords')
	keys = ['m']
	group = 'views'
	execute() { this.calendar.setView('month') }
}

@command()
export class YearView extends Command {
	heading = t('Year View')
	icon = 'rows-3'
	keywords = t('YearView.Keywords')
	keys = ['y']
	group = 'views'
	execute() { this.calendar.setView('year') }
}
