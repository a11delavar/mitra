import { DateTime } from '@3mo/date-time'
import { command, Command } from '../../commands/Command.js'
import { CalendarPeriod } from './CalendarPeriod.js'

function rtl() {
	return getComputedStyle(document.documentElement).direction === 'rtl'
}

/** A view with no period to step (the table) leaves the arrow keys alone and keeps the commands off the palette's unsearched list. */
abstract class StepPeriod extends Command {
	protected abstract readonly direction: 1 | -1
	protected get period() { return this.calendar.period }
	group = 'navigation' as const
	override get listedWithoutQuery() { return !!this.period }
	execute() {
		const { calendar, period } = this
		if (period) {
			calendar.navigatingDate = this.direction > 0 ? calendar.navigatingDate.add(period.step) : calendar.navigatingDate.subtract(period.step)
		}
	}
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
export class NextPeriod extends StepPeriod {
	protected readonly direction = 1
	get heading() { return (this.period ?? CalendarPeriod.of('month')).nextLabel }
	icon = 'arrow-right'
	keywords = t('NextPeriod.Keywords')
	get keys() { return !this.period ? undefined : [rtl() ? 'ArrowLeft' : 'ArrowRight'] }
	override get shortcutLabel() { return t('Forward') }
}

@command()
export class PreviousPeriod extends StepPeriod {
	protected readonly direction = -1
	get heading() { return (this.period ?? CalendarPeriod.of('month')).previousLabel }
	icon = 'arrow-left'
	keywords = t('PreviousPeriod.Keywords')
	get keys() { return !this.period ? undefined : [rtl() ? 'ArrowRight' : 'ArrowLeft'] }
	override get shortcutLabel() { return t('Back') }
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
