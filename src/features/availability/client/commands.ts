import { DateTime } from '@3mo/date-time'
import { Entry, EntryType } from '#features/entries'
import { Recurrence, RecurrenceWeekday, RecurrenceFrequency } from '#features/recurrence'
import { EntryStore, reportSaveError } from '#features/entries/client/EntryStore.js'
import { EntryEditorIntent } from '#features/entries/client/EntryEditorIntent.js'
import { Calendars } from '#features/sources/client/Calendars.js'
import { command, Command } from '#features/commands/Command.js'

const START_HOUR = 9
const END_HOUR = 17

/**
 * Adds availability to the default calendar: working hours from Monday to Friday if it has none yet, otherwise a
 * window on today's weekday. Saved right away instead of staying a draft, because its defaults are already complete.
 */
@command()
export class CreateAvailability extends Command {
	readonly heading = t('Add Availability')
	readonly icon = 'columns-3'
	readonly keywords = t('CreateAvailability.Keywords')
	readonly keys = []
	readonly group = undefined

	override execute() {
		const { calendar } = this
		const target = Calendars.primary(EntryType.Availability)
		if (!target || !target.capabilities.entries.create) {
			return
		}

		const today = new DateTime()
		const first = !EntryStore.entries.some(entry => entry.type.isAvailability && entry.sourceId === target.id)
		const days = first ? RecurrenceWeekday.workdays() : [RecurrenceWeekday.of(today)]
		const start = today.firstOccurrenceOn(days).with({ hour: START_HOUR })
		const entry = new Entry({
			sourceId: target.id,
			type: EntryType.Availability,
			heading: '',
			start,
			end: start.with({ hour: END_HOUR }),
			allDay: false,
			recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: days }),
		})

		calendar.setView('week')
		calendar.navigatingDate = start
		EntryStore.upsertDraft(entry)
		// Opened by id: a saved series master only reaches the calendar as its expanded occurrences.
		EntryStore.commit(entry)
			.then(() => entry.id && EntryEditorIntent.requestOpen(entry.id))
			.catch(reportSaveError)
	}
}
