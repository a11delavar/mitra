import { type EntityManager } from '@mikro-orm/sqlite'
import { Source } from '../../../features/sources/Source.js'
import { Entry, Transparency } from '../../../features/entries/Entry.js'
import { EntryType } from '../../../features/entries/EntryType.js'
import { Recurrence } from '../../../features/recurrence/Recurrence.js'
import { createLogger } from '../../../infrastructure/logging/Logger.js'
import { CalDAV } from '../CalDAV.js'

const logger = createLogger('CalDAV')

interface Plan {
	readonly create: ReadonlyArray<Entry>
	readonly update: ReadonlyArray<readonly [existing: Entry, desired: Entry]>
	readonly remove: ReadonlyArray<Entry>
}

/**
 * Writes each busy availability entry into its own calendar as a busy event series, so other apps and
 * people inviting the user see the time as taken. Free availability is never written.
 */
export class CalDAVAvailability {
	static uidOf(entry: Entry) {
		return `${CalDAV.availabilityUidPrefix}${entry.uid ?? entry.id}`
	}

	/** The busy event series an availability entry becomes in its calendar. */
	static eventOf(entry: Entry): Entry {
		return new Entry({
			id: crypto.randomUUID(),
			uid: CalDAVAvailability.uidOf(entry),
			sourceId: entry.sourceId,
			type: EntryType.Event,
			heading: entry.heading || 'Busy',
			start: entry.start,
			end: entry.end,
			allDay: entry.allDay,
			timeZone: entry.timeZone,
			transparency: Transparency.Busy,
			visibility: entry.visibility,
			location: entry.location,
			recurrence: entry.recurrence,
			exdates: entry.exdates ? [...entry.exdates] : undefined,
		})
	}

	/** Whether the server takes busy events in this calendar. */
	static writable(source: Source) {
		return source.enabled && !source.readOnly && source.supportsEntryType(EntryType.Event)
	}

	/**
	 * Compares only the fields {@link eventOf} sets. Not `editEquals`: a row read from the database
	 * holds `Date`s and nulls where a fresh event holds `DateTime`s and absent fields.
	 */
	static matches(event: Entry, desired: Entry): boolean {
		const instant = (value?: Date | null) => value?.valueOf() ?? null
		const exdates = (entry: Entry) => [...entry.exdates ?? []].sort((a, b) => a - b).join(',')
		return event.sourceId === desired.sourceId
			&& event.type === desired.type
			&& event.heading === desired.heading
			&& instant(event.start) === instant(desired.start)
			&& instant(event.end) === instant(desired.end)
			&& !!event.allDay === !!desired.allDay
			&& (event.timeZone ?? null) === (desired.timeZone ?? null)
			&& (event.transparency ?? null) === (desired.transparency ?? null)
			&& (event.visibility ?? null) === (desired.visibility ?? null)
			&& (event.location || '') === (desired.location || '')
			&& Recurrence.equal(event.recurrence, desired.recurrence)
			&& exdates(event) === exdates(desired)
	}

	/** What to write so that `existing` becomes exactly one busy event per busy entry whose calendar is among `calendars`. */
	static plan(existing: ReadonlyArray<Entry>, entries: ReadonlyArray<Entry>, calendars: ReadonlySet<string>): Plan {
		const desired = entries
			.filter(entry => entry.type.isAvailability && entry.showAs === Transparency.Busy && entry.start && calendars.has(entry.sourceId))
			.map(entry => CalDAVAvailability.eventOf(entry))
		const wanted = new Map(desired.map(event => [event.uid!, event]))
		const kept = existing.filter(event => wanted.get(event.uid!)?.sourceId === event.sourceId)
		const found = new Map(kept.map(event => [event.uid!, event]))
		return {
			create: desired.filter(event => !found.has(event.uid!)),
			update: kept.map(event => [event, wanted.get(event.uid!)!] as const).filter(([event, want]) => !CalDAVAvailability.matches(event, want)),
			remove: existing.filter(event => !kept.includes(event)),
		}
	}

	/**
	 * Brings the busy events in line with `entries`, in every calendar of the account or `only` in one, and for all
	 * availability or only for the entries in `of` (one entry's change leaves the others' events alone).
	 * @returns whether it wrote anything.
	 */
	static async publish(integration: CalDAV, em: EntityManager, entries: ReadonlyArray<Entry>, { only, of }: { only?: Source, of?: ReadonlyArray<Entry> } = {}): Promise<boolean> {
		const sources = only ? [only] : await em.find(Source, { integrationId: integration.id })
		const existing = await em.find(Entry, {
			sourceId: { $in: sources.map(source => source.id) },
			uid: of ? { $in: of.map(entry => CalDAVAvailability.uidOf(entry)) } : { $like: `${CalDAV.availabilityUidPrefix}%` },
			recurrenceId: null,
		})
		const calendars = new Set(sources.filter(source => CalDAVAvailability.writable(source)).map(source => source.id))
		const { create, update, remove } = CalDAVAvailability.plan(existing, entries, calendars)
		for (const event of remove) {
			await integration.deleteEntry(em, event)
		}
		for (const [event, desired] of update) {
			await integration.updateEntry(em, event, desired)
		}
		for (const event of create) {
			await integration.createEntry(em, event)
		}
		const changes = create.length + update.length + remove.length
		if (changes) {
			logger.debug(`Wrote ${changes} busy availability event(s) to ${integration.toString()}`)
		}
		return changes > 0
	}
}
