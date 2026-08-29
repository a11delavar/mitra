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

	/** A blank one-hour draft at the next full hour today, on the primary source — the same target a
	 * create gesture picks — navigated into view with its editor open. Always lands in the week view:
	 * the timed grid renders every draft, whereas a crowded month cell folds it into "+N more" and
	 * the editor could never open. */
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
			// An event unless the target can only hold tasks — the same rule the create gestures follow.
			type: source.defaultEntryType,
			heading: '',
			start,
			end: start.add({ hours: 1 }),
			allDay: false,
			// A timed draft — same default as a create gesture, same capability guard (see EntryDragController).
			reminders: getCapabilities(source.id).reminders ? DefaultReminderSetting.reminders : undefined,
		})
		EntryStore.upsertDraft(draft)
		EntryEditorIntent.openDraft(draft)
	}
}
