import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { tool } from '#features/agents/server/tool.js'
import type { EntryOccurrence } from '#features/recurrence'
import { TimeZone } from '#features/time/TimeZone.js'
import { validation } from '#infrastructure/validation'
import { operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { RoutineEntries } from '../RoutineEntries.js'

class Parameters {
	@validation(z.number().int().min(1).max(1000).optional())
	@description('How many of each routine\'s last dates to answer with, and to count kept among; 14 without.')
	readonly last?: number
}

@operation(Parameters)
@label('Routines')
@description('Gives the routines in the enabled calendars: what the person keeps doing, each a group of entries of one calendar sharing a title, repeating or not. Each with how often it comes in days, its tightest rule, since when, its last dates and the next, how many of them were kept, and the weekday it slips on most; the next date first. A date is its entry\'s `id`, heading and type, with that date\'s start, end and due and its `status`: kept, cancelled, missed (a task left open past its day), open (today\'s) or upcoming. A date of a repeating entry also has its `occurrence`, its original start, as the overview names it and complete_task takes it. Days are in the home zone.')
@tool({ name: 'get_routines', annotations: { readOnlyHint: true } })
export class GetRoutines extends Operation<Parameters> {
	async run({ em, user }: OperationContext) {
		const last = this.parameters.last ?? 14
		const zone = user.timeZones?.home?.zone ?? TimeZone.UTC
		const now = new Date()
		const routines = await user.getRoutines(em)
		const members = Map.groupBy(await user.getRoutineEntries(em, routines), member => member.routineId!)
		const items = routines.map(routine => {
			const entries = RoutineEntries.of(members.get(routine.id) ?? [])
			const dates = entries.occurrencesAt(now, zone)
			const { tightest } = entries
			// A date as the overview names one, with where it stands: the occurrences themselves stay off the wire.
			const dateOf = (occurrence: EntryOccurrence | undefined) => occurrence && {
				id: occurrence.entry.id,
				...occurrence.recurring ? { occurrence: occurrence.storedRecurrenceId } : {},
				type: String(occurrence.entry.type),
				heading: occurrence.entry.heading,
				start: occurrence.start,
				end: occurrence.end,
				due: occurrence.due,
				status: String(dates.statusOf(occurrence)),
			}
			return {
				id: routine.id,
				name: routine.name,
				titles: routine.titles,
				sourceId: routine.sourceId,
				cadence: routine.cadence?.days,
				rule: tightest?.recurrence?.toRRule(tightest.allDay),
				since: dates.since?.toString(),
				kept: dates.kept(last),
				of: dates.settled(last),
				slips: dates.slipsAfter(zone.dayOf(now).subtract({ years: 1 })),
				occurrences: dates.last(last).map(dateOf),
				next: dateOf(dates.next),
			}
		})
		const next = (item: (typeof items)[number]) => (item.next?.start ?? item.next?.due)?.valueOf() ?? Infinity
		return { items: items.sort((a, b) => next(a) - next(b)) }
	}
}
