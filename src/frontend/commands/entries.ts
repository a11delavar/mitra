import { DateTime } from '@3mo/date-time'
import { Entry, EntryType, SourceType, DEFAULT_REMINDER_MINUTES } from 'shared'
import { getPrimarySource, getCapabilities } from '../Api.js'
import { EntryStore } from '../EntryStore.js'
import { command, Command } from './Command.js'

@command()
export class CreateEntry extends Command {
	heading = t('Create Entry')
	icon = 'plus'
	keywords = t('new event task add')
	keys = ['c']
	group = 'entries'

	/** A blank one-hour draft at the next full hour today, on the primary source — the same target a
	 * create gesture picks — navigated into view with its editor open. Always lands in the week view:
	 * the timed grid renders every draft, whereas a crowded month cell folds it into "+N more" and
	 * the editor could never open. */
	override execute() {
		const { calendar } = this
		const source = getPrimarySource()
		if (!source) {
			return
		}
		const now = new DateTime()
		const start = now.dayStart.add({ hours: now.hour + 1 })
		calendar.setView('week')
		calendar.navigatingDate = now
		EntryStore.upsertDraft(new Entry({
			sourceId: source.id,
			type: source.type === SourceType.Task ? EntryType.Task : EntryType.Event,
			heading: '',
			start,
			end: start.add({ hours: 1 }),
			allDay: false,
			// A timed draft — same default as a create gesture, same capability guard (see EntryDragController).
			reminders: getCapabilities(source.id).reminders ? [DEFAULT_REMINDER_MINUTES] : undefined,
		}))
		EntryStore.openDraft()
	}
}
