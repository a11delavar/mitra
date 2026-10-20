import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { DateTime, DateTimeRange } from '@3mo/date-time'
import { EntryOccurrences, type EntryOccurrence } from '#features/recurrence'
import { TimeZone } from '#features/time/TimeZone.js'
import { tool } from '#features/agents/server/tool.js'
import { validation } from '#infrastructure/validation'
import { operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { Entry } from '../Entry.js'
import { entryWindow, recurringEntries } from './entryWindow.js'

/** A bound of the overview as written: an instant as it is, a day from its start or through its end in `zone`. */
function boundOf(value: string, field: 'start' | 'end', zone: TimeZone) {
	if (value.includes('T')) {
		return new Date(value)
	}
	const day = Temporal.PlainDate.from(value)
	return new Date(field === 'start'
		? day.toZonedDateTime(zone.id).epochMilliseconds
		: day.add({ days: 1 }).toZonedDateTime(zone.id).subtract({ milliseconds: 1 }).epochMilliseconds)
}

class Parameters {
	@validation(z.union([z.iso.datetime({ offset: true }), z.iso.date()]))
	@description('The first day (2026-10-19) of the overview, from its start in the home zone, or an instant with its offset.')
	readonly start!: string

	@validation(z.union([z.iso.datetime({ offset: true }), z.iso.date()]))
	@description('The last day (2026-10-25) of the overview, through its end in the home zone, or an instant with its offset.')
	readonly end!: string

	@validation(z.array(z.string()).optional())
	@description('Only these calendars, by id; without, every calendar.')
	readonly sourceIds?: ReadonlyArray<string>
}

const maximumEntries = 200

const startOf = (occurrence: EntryOccurrence) => (occurrence.start ?? occurrence.due)?.valueOf() ?? Infinity

type Part = 'entries' | 'availability' | 'overdue' | 'unscheduled'

/**
 * Which part of the overview an occurrence belongs to, which a query by instants answers too widely for all-day dates:
 * those cover their days in `zone`. Taking place in the window, an open task overdue from before it, unscheduled, or none.
 */
function partOf(occurrence: EntryOccurrence, start: Date, end: Date, zone: TimeZone): Part | undefined {
	const { entry } = occurrence
	if (!occurrence.start) {
		return 'unscheduled'
	}
	const [from, to] = !entry.allDay
		? [occurrence.start.valueOf(), (occurrence.end ?? occurrence.start).valueOf()]
		: [zone.midnightOf(TimeZone.UTC.dayOf(occurrence.start)).getTime(), zone.midnightOf(occurrence.end && occurrence.end.valueOf() > occurrence.start.valueOf() ? TimeZone.UTC.dayOf(occurrence.end) : TimeZone.UTC.dayOf(occurrence.start).add({ days: 1 })).getTime()]
	if (from <= end.getTime() && (to > start.getTime() || from >= start.getTime())) {
		return entry.type.isAvailability ? 'availability' : 'entries'
	}
	return entry.type.isTask && !entry.closed && !occurrence.recurring && to <= start.getTime() ? 'overdue' : undefined
}

@operation(Parameters)
@label('Overview')
@description('Gives the overview of a stretch of time: the entries taking place in it, each repeating one once per occurrence with that occurrence\'s id, its original start, which changing or deleting that occurrence takes; the availability in it, when the person is free or busy; the open tasks overdue from before it; and the unscheduled tasks. At most 200 entries; a shorter stretch gives the rest.')
@tool({ name: 'get_overview', annotations: { readOnlyHint: true } })
export class GetOverview extends Operation<Parameters> {
	async run({ em, user }: OperationContext) {
		const zone = user.timeZones?.home?.zone ?? TimeZone.UTC
		const start = boundOf(this.parameters.start, 'start', zone)
		const end = boundOf(this.parameters.end, 'end', zone)
		const sourceIds = this.parameters.sourceIds ?? (await user.sources(em, { enabled: true })).map(source => source.id)
		const entries = [...await em.find(Entry, entryWindow(sourceIds, start, end)), ...await recurringEntries(em, sourceIds)]
		const graph = await user.relationGraph(em)
		graph.attach(entries)

		const integrations = await user.integrations(em)
		const integrationOf = new Map((await user.sources(em)).map(source => [source.id, integrations.find(integration => integration.id === source.integrationId)]))
		// Repeating entries unrolled as the browser unrolls them, without the busy copies a provider holds of availability.
		const occurrences = [
			...entries.filter(entry => !entry.recurrence).map(entry => entry.occurrences.single),
			...EntryOccurrences.inWindow(entries.filter(entry => entry.recurrence), new DateTimeRange(new DateTime(start.getTime()), new DateTime(end.getTime()))),
		]
			.filter(({ entry }) => !integrationOf.get(entry.sourceId)?.writtenForAvailability(entry))
			.sort((a, b) => startOf(a) - startOf(b))

		const parts = Map.groupBy(occurrences.slice(0, maximumEntries), occurrence => partOf(occurrence, start, end, zone))
		const part = (name: Part) => (parts.get(name) ?? []).map(occurrence => {
			const { overrides: _, ...entry } = JSON.parse(JSON.stringify(occurrence.entry)) as Record<string, unknown>
			return { ...entry, start: occurrence.start, end: occurrence.end, due: occurrence.due, ...occurrence.recurring ? { occurrence: occurrence.storedRecurrenceId } : {} }
		})
		return {
			entries: part('entries'),
			availability: part('availability'),
			overdue: part('overdue'),
			unscheduled: part('unscheduled'),
			...occurrences.length > maximumEntries ? { more: occurrences.length - maximumEntries } : {},
		}
	}
}
