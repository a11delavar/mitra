import { DateTime } from '@3mo/date-time'
import { ReminderSetting } from '#features/reminders/client/DefaultReminderSetting.js'
import { Calendars } from '#features/sources/client/Calendars.js'
import { command, Command } from '#features/commands/Command.js'
import { Entry } from '../Entry.js'
import { EntryType } from '../EntryType.js'
import { EntryStore } from './EntryStore.js'
import { EntryEditorIntent } from './EntryEditorIntent.js'

@command()
export class CreateEntry extends Command {
	heading = t('Create Entry')
	icon = 'plus'
	keywords = t('CreateEntry.Keywords')
	keys = ['c']
	group = 'entries'

	override execute() {
		const { calendar } = this
		const source = Calendars.primary()
		if (!source || !source.capabilities.entries.create) {
			return
		}
		const now = new DateTime()
		const start = now.dayStart.add({ hours: now.hour + 1 })
		// Every view shows the draft where it is, but the timeline lists only tasks: there it is a task, and a
		// calendar that holds none hands over to the week.
		const timelineTask = calendar.view === 'timeline' && source.supportsEntryType(EntryType.Task)
		if (calendar.view === 'timeline' && !timelineTask) {
			calendar.setView('week')
		}
		calendar.navigatingDate = now
		const draft = new Entry({
			sourceId: source.id,
			type: timelineTask ? EntryType.Task : source.defaultEntryType,
			heading: '',
			start,
			end: start.add({ hours: 1 }),
			allDay: false,
		})
		if (source.ownership.holds('reminders')) {
			draft.adoptDefaultReminders(ReminderSetting.defaults)
		}
		EntryStore.upsertDraft(draft)
		EntryEditorIntent.openDraft(draft)
	}
}
