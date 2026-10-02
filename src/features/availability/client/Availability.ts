import { type DateTime } from '@3mo/date-time'
import { type Entry } from '../../entries/Entry.js'
import { type EntrySegment } from '../../entries/client/EntrySegment.js'
import { EntrySegments } from '../../entries/client/EntrySegments.js'
import { getIntegrationFor } from '../../../infrastructure/http/Api.js'
import { HideAvailabilitySetting } from './HideAvailabilitySetting.js'

interface Partition {
	readonly availability: ReadonlyArray<Entry>
	readonly rest: ReadonlyArray<Entry>
}

/** One day's slice of an availability entry, and where its label sits in it. */
export interface AvailabilityPlacement {
	readonly segment: EntrySegment
	/** From its start (0) to its end (1): centred alone, spread out among the slices it shares time with. */
	readonly labelAt: number
}

type Slice = Pick<EntrySegment, 'startMinute' | 'endMinute'>

/**
 * Separates availability from a view's other entries. Availability is drawn as a window with a ribbon, never as chips,
 * so every layout drops it first, along with the events a provider holds for it. Memoized on the array's
 * identity so the layout caches stay valid.
 */
export class Availability {
	private static readonly partitions = new WeakMap<ReadonlyArray<Entry>, Partition>()

	private static partition(entries: ReadonlyArray<Entry>): Partition {
		let partition = Availability.partitions.get(entries)
		if (!partition) {
			const availability = entries.filter(entry => entry.type.isAvailability)
			const shown = (entry: Entry) => !entry.type.isAvailability && !getIntegrationFor(entry.sourceId)?.writtenForAvailability(entry)
			const rest = entries.filter(shown)
			partition = { availability, rest: rest.length === entries.length ? entries : rest }
			Availability.partitions.set(entries, partition)
		}
		return partition
	}

	/** Everything except availability and the events written for it. */
	static outside(entries: ReadonlyArray<Entry>): ReadonlyArray<Entry> {
		return Availability.partition(entries).rest
	}

	static readonly none: ReadonlyArray<AvailabilityPlacement> = []

	/**
	 * What its ribbon says: its name and where it is, whichever it has. The color already says what it is for, so a
	 * window with neither is drawn as a thin line and takes no place among the labels.
	 */
	static labelOf(entry: Pick<Entry, 'heading' | 'location'>) {
		return [entry.heading, entry.location].map(part => part?.trim()).filter(Boolean).join(' · ')
	}

	private static readonly byDay = new WeakMap<ReadonlyArray<Entry>, Map<number, ReadonlyArray<AvailabilityPlacement>>>()

	/**
	 * Where each slice's label sits, from its start (0) to its end (1). A slice alone is centred. Slices that share time
	 * form a group and spread their labels in the order of their middles: deep work from 9 to 12 inside working hours
	 * from 9 to 17 takes the start, and the working hours the end, so the two labels stay apart.
	 */
	static labelPositions(slices: ReadonlyArray<Slice>): Array<number> {
		const order = slices.map((_, index) => index).sort((a, b) => slices[a]!.startMinute - slices[b]!.startMinute || slices[b]!.endMinute - slices[a]!.endMinute)
		const groups = new Array<Array<number>>()
		let groupEnd = -Infinity
		for (const index of order) {
			const slice = slices[index]!
			if (slice.startMinute < groupEnd) {
				groups.at(-1)!.push(index)
				groupEnd = Math.max(groupEnd, slice.endMinute)
			} else {
				groups.push([index])
				groupEnd = slice.endMinute
			}
		}
		const middle = (index: number) => slices[index]!.startMinute + slices[index]!.endMinute
		const positions = new Array<number>(slices.length)
		for (const group of groups) {
			group.sort((a, b) => middle(a) - middle(b) || slices[a]!.startMinute - slices[b]!.startMinute)
				.forEach((index, rank) => positions[index] = group.length === 1 ? 0.5 : rank / (group.length - 1))
		}
		return positions
	}

	/** The availability on one day. None while the lens hides availability. */
	static on(entries: ReadonlyArray<Entry>, date: DateTime): ReadonlyArray<AvailabilityPlacement> {
		if (HideAvailabilitySetting.current) {
			return Availability.none
		}
		let index = Availability.byDay.get(entries)
		if (!index) {
			const segmentsByDay = new Map<number, Array<EntrySegment>>()
			for (const entry of Availability.partition(entries).availability) {
				for (const segment of EntrySegments.for(entry)) {
					if (segment.dayValue === undefined) {
						continue
					}
					const day = segmentsByDay.get(segment.dayValue)
					day ? day.push(segment) : segmentsByDay.set(segment.dayValue, [segment])
				}
			}
			index = new Map()
			for (const [dayValue, segments] of segmentsByDay) {
				const labelled = segments.filter(segment => Availability.labelOf(segment.entry))
				const positions = Availability.labelPositions(labelled)
				index.set(dayValue, segments.map(segment => ({ segment, labelAt: positions[labelled.indexOf(segment)] ?? 0.5 })))
			}
			Availability.byDay.set(entries, index)
		}
		return index.get(date.dayStart.valueOf()) ?? Availability.none
	}
}
