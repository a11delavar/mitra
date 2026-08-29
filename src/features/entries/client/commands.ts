import { DateTime } from '@3mo/date-time'
import { Entry } from '../Entry.js'
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
		calendar.setView('week')
		calendar.navigatingDate = now
		const draft = new Entry({
			sourceId: source.id,
			type: source.defaultEntryType,
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
