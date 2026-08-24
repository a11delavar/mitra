import { DateTime } from '@3mo/date-time'
import { command, Command } from '../../commands/Command.js'

/** The future sits to the LEFT in an RTL layout — the arrow keys follow time, not the key cap, so
 * "toward the future" stays under the same finger in either direction. */
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
	/** One of whatever the view shows — a getter, since it names the CURRENT view's unit. */
	get heading() {
		switch (this.calendar.view) {
			case 'month': return t('Next Month')
			case 'year': return t('Next Year')
			default: return t('Next Week')
		}
	}
	icon = 'arrow-right'
	keywords = t('NextPeriod.Keywords')
	/** The key that means "forward" — a getter, because it follows TIME rather than the layout: an RTL
	 * calendar runs right-to-left, so the future is the LEFT arrow there. Everything derived from
	 * `keys` (the interceptor's match, the palette's hint, the sheet's chip) flips with it. */
	get keys() { return [rtl() ? 'ArrowLeft' : 'ArrowRight'] }
	group = 'navigation'
	/** The sheet says "Forward" — unit-free, because one row stands for all three views. */
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
