import { DateTime } from '@3mo/date-time'
import { EntryType, ScheduleDefaults } from '#features/entries'
import { Recurrence, RecurrenceWeekday, RecurrenceFrequency } from '#features/recurrence'
import { EntryStore, reportSaveError } from '#features/entries/client/EntryStore.js'
import { EntryEditorIntent } from '#features/entries/client/EntryEditorIntent.js'
import { Calendars } from '#features/sources/client/Calendars.js'
import { command, Command } from '#features/commands/Command.js'

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
		const target = Calendars.getPrimary(EntryType.Availability)
		if (!target) {
			return
		}

		const today = new DateTime()
		const first = !EntryStore.entries.some(entry => entry.type.isAvailability && entry.sourceId === target.id)
		const days = first ? RecurrenceWeekday.workdays() : [RecurrenceWeekday.of(today)]
		const { workday } = ScheduleDefaults.current
		const start = today.firstOccurrenceOn(days).with({ hour: workday.start })
		const entry = target.draft({
			type: EntryType.Availability,
			start,
			end: start.with({ hour: workday.end }),
			allDay: false,
			recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: days }),
		})

		calendar.setView('week')
		calendar.navigatingDate = start
		EntryStore.pending.upsertDraft(entry)
		// Opened by id: a saved series master only reaches the calendar as its expanded occurrences.
		EntryStore.commit(entry)
			.then(() => entry.id && EntryEditorIntent.requestOpen(entry.id))
			.catch(reportSaveError)
	}
}
