import { type DateTime } from '@3mo/date-time'
import { Recurrence } from '../Recurrence.js'
import { RecurrenceFrequency } from '../RecurrenceFrequency.js'
import { RecurrenceWeekday } from '../RecurrenceWeekday.js'

/** One of the Repeat row's quick choices, derived from where the rule starts: never repeating, or a rule of its own. */
export class RecurrencePreset {
	/** The quick choices for a rule starting at `start`, the last weekday of the month only where `start` is one. */
	static of(start: DateTime) {
		const weekday = RecurrenceWeekday.of(start)
		const workdays = RecurrenceWeekday.workdays()
		const on = String(t('on ${weekday}', { weekday: weekday.format() }))
		const dayOfMonth = start.recurrenceDate.day
		return [
			new RecurrencePreset('none', String(t('Does not repeat'))),
			new RecurrencePreset('daily', RecurrenceFrequency.Daily.format(), undefined, new Recurrence({ freq: RecurrenceFrequency.Daily })),
			new RecurrencePreset('weekday', String(t('Every weekday')), `${workdays[0]!.format()} – ${workdays.at(-1)!.format()}`, new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: workdays })),
			new RecurrencePreset('weekly', RecurrenceFrequency.Weekly.format(), on, new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: [weekday] })),
			new RecurrencePreset('biweekly', RecurrenceFrequency.Weekly.format(2), on, new Recurrence({ freq: RecurrenceFrequency.Weekly, interval: 2, byday: [weekday] })),
			new RecurrencePreset('monthly-day', RecurrenceFrequency.Monthly.format(), Recurrence.monthDayLabel(dayOfMonth), new Recurrence({ freq: RecurrenceFrequency.Monthly, bymonthday: dayOfMonth })),
			new RecurrencePreset('monthly-weekday', RecurrenceFrequency.Monthly.format(), Recurrence.monthWeekdayLabel(start.weekdayOfMonth), new Recurrence({ freq: RecurrenceFrequency.Monthly, byday: [start.weekdayOfMonth] })),
			...start.lastWeekdayOfMonth ? [new RecurrencePreset('monthly-last', RecurrenceFrequency.Monthly.format(), Recurrence.monthWeekdayLabel(weekday.nth(-1)), new Recurrence({ freq: RecurrenceFrequency.Monthly, byday: [weekday.nth(-1)] }))] : [],
			new RecurrencePreset('yearly', RecurrenceFrequency.Yearly.format(), String(t('on ${date}', { date: start.formatAsAnniversary() })), new Recurrence({ freq: RecurrenceFrequency.Yearly })),
		]
	}

	/** The id of the preset among `presets` that is `recurrence`, `none` for no rule, none where it is a rule of its own. */
	static chosenIn(presets: ReadonlyArray<RecurrencePreset>, recurrence?: Recurrence) {
		return !recurrence ? 'none' : presets.find(preset => preset.recurrence?.equals(recurrence))?.id
	}

	constructor(readonly id: string, readonly label: string, readonly detail?: string, readonly recurrence?: Recurrence) { }
}
