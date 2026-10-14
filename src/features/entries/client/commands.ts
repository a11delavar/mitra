import { DateTime } from '@3mo/date-time'
import { Entry } from '../Entry.js'
import { EntryType } from '../EntryType.js'
import { ReminderSetting } from '../../reminders/client/DefaultReminderSetting.js'
import { Calendars } from '../../sources/client/Calendars.js'
import { EntryStore } from './EntryStore.js'
import { EntryEditorIntent } from './EntryEditorIntent.js'
import { command, Command } from '../../commands/Command.js'

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
		if (!source || !Calendars.capabilitiesOf(source.id).entries.create) {
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
		if (Calendars.ownershipOf(source.id).holds('reminders')) {
			draft.adoptDefaultReminders(ReminderSetting.defaults)
		}
		EntryStore.upsertDraft(draft)
		EntryEditorIntent.openDraft(draft)
	}
}
