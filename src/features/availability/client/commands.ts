import { type DateTime, DateTime as Now } from '@3mo/date-time'
import { Entry } from '../../entries/Entry.js'
import { EntryType } from '../../entries/EntryType.js'
import { Recurrence } from '../../recurrence/Recurrence.js'
import { RecurrenceWeekday } from '../../recurrence/RecurrenceWeekday.js'
import { EntryStore, reportSaveError } from '../../entries/client/EntryStore.js'
import { EntryEditorIntent } from '../../entries/client/EntryEditorIntent.js'
import { getCapabilities, getPrimarySource } from '../../../infrastructure/http/Api.js'
import { command, Command } from '../../commands/Command.js'
import { RecurrenceFrequency } from '../../recurrence/RecurrenceFrequency.js'

const START_HOUR = 9
const END_HOUR = 17

/** The first day from `from` on that matches `days`. RFC 5545 counts DTSTART as an occurrence whatever BYDAY says, so starting elsewhere would shade a stray day. */
function firstDayMatching(days: ReadonlyArray<RecurrenceWeekday>, from: DateTime): DateTime {
	const week = Array.from({ length: 7 }, (_, offset) => from.dayStart.add({ days: offset }))
	return week.find(day => days.includes(RecurrenceWeekday.of(day))) ?? from.dayStart
}

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
		const target = getPrimarySource(EntryType.Availability)
		if (!target || !getCapabilities(target.id).createEntries) {
			return
		}

		const today = new Now()
		const first = !EntryStore.entries.some(entry => entry.type.isAvailability && entry.sourceId === target.id)
		const days = first ? RecurrenceWeekday.workdays() : [RecurrenceWeekday.of(today)]
		const start = firstDayMatching(days, today).with({ hour: START_HOUR })
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
