import { DateTime } from '@3mo/date-time'
import { Entry } from '../Entry.js'
import { EntryType } from '../EntryType.js'
import { DefaultReminderSetting } from '../../reminders/client/DefaultReminderSetting.js'
import { getPrimarySource, getCapabilities } from '../../../infrastructure/http/Api.js'
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
		const source = getPrimarySource()
		if (!source || !getCapabilities(source.id).createEntries) {
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
			reminders: getCapabilities(source.id).reminders ? DefaultReminderSetting.reminders : undefined,
		})
		EntryStore.upsertDraft(draft)
		EntryEditorIntent.openDraft(draft)
	}
}
