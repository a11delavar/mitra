import { DateTime } from '@3mo/date-time'
import { command, Command } from '../../commands/Command.js'

function rtl() {
	return getComputedStyle(document.documentElement).direction === 'rtl'
}

@command()
export class GoToToday extends Command {
	heading = t('Go to Today')
	icon = 'calendar-check'
	keywords = t('GoToToday.Keywords')
	keys = ['t']
	group = 'navigation'
	execute() { this.calendar.navigatingDate = new DateTime() }
}

@command()
export class NextPeriod extends Command {
	get heading() {
		switch (this.calendar.view) {
			case 'month': return t('Next Month')
			case 'year': return t('Next Year')
			default: return t('Next Week')
		}
	}
	icon = 'arrow-right'
	keywords = t('NextPeriod.Keywords')
	get keys() { return [rtl() ? 'ArrowLeft' : 'ArrowRight'] }
	group = 'navigation'
	override get shortcutLabel() { return t('Forward') }
	execute() {
		const { calendar } = this
		calendar.navigatingDate = calendar.navigatingDate.add(calendar.navigationStep)
	}
}

@command()
export class PreviousPeriod extends Command {
	get heading() {
		switch (this.calendar.view) {
			case 'month': return t('Previous Month')
			case 'year': return t('Previous Year')
			default: return t('Previous Week')
		}
	}
	icon = 'arrow-left'
	keywords = t('PreviousPeriod.Keywords')
	get keys() { return [rtl() ? 'ArrowRight' : 'ArrowLeft'] }
	group = 'navigation'
	override get shortcutLabel() { return t('Back') }
	execute() {
		const { calendar } = this
		calendar.navigatingDate = calendar.navigatingDate.subtract(calendar.navigationStep)
	}
}

@command()
export class GoToDate extends Command {
	heading = t('Go to Date…')
	icon = 'calendar-search'
	keywords = t('GoToDate.Keywords')
	keys = ['g']
	group = 'navigation'
	execute() { this.calendar.goToDate() }
}
