import { DateTime } from '@3mo/date-time'
import type { CalendarEvent } from './CalendarEvent.js'

export class EventSegment {
	continuesNext?: boolean
	continuedFromPrevious?: boolean
	slot?: number
	total?: number
	span?: number
	monthSlot?: number
	segmentDate?: DateTime

	constructor(readonly event: CalendarEvent, init?: Partial<Omit<EventSegment, 'event'>>) {
		Object.assign(this, init)
	}

	get startMinute() {
		if (this.continuedFromPrevious) return 1
		return this.event.start ? this.event.start.hour * 60 + this.event.start.minute + 1 : 1
	}

	get endMinute() {
		if (this.continuesNext) return 1441
		return this.event.end ? this.event.end.hour * 60 + this.event.end.minute + 1 : 2
	}

	get duration() {
		return this.endMinute - this.startMinute
	}

	get isTimed() {
		if (this.continuedFromPrevious || this.continuesNext) return false
		if (this.event.allDay) return false
		return true
	}

	compareTo(other: EventSegment) {
		if (this.startMinute !== other.startMinute) {
			return this.startMinute - other.startMinute
		}
		return other.duration - this.duration
	}

	overlapsWith(other: EventSegment) {
		return Math.max(this.startMinute, other.startMinute) < Math.min(this.endMinute, other.endMinute)
	}

	fallsOnDay(date: DateTime) {
		const dayStart = date.dayStart

		if (this.segmentDate) {
			return this.segmentDate.dayStart.equals(dayStart)
		}

		const start = this.event.start
		const dayEnd = dayStart.add({ days: 1 })
		return !!start && (start.equals(dayStart) || start.isAfter(dayStart)) && start.isBefore(dayEnd)
	}

	static cluster(segments: Array<EventSegment>) {
		if (!segments?.length) {
			return []
		}

		const sorted = [...segments].sort((a, b) => a.compareTo(b))

		const clusters: Array<Array<EventSegment>> = []
		let currentCluster = new Array<EventSegment>()
		let clusterEnd = -1

		for (const segment of sorted) {
			if (currentCluster.length === 0 || segment.startMinute < clusterEnd) {
				currentCluster.push(segment)
				clusterEnd = Math.max(clusterEnd, segment.endMinute)
			} else {
				clusters.push(currentCluster)
				currentCluster = [segment]
				clusterEnd = segment.endMinute
			}
		}
		if (currentCluster.length > 0) {
			clusters.push(currentCluster)
		}

		for (const cluster of clusters) {
			const columns = new Array<EventSegment[]>()

			for (const segment of cluster) {
				const col = columns.find(c => c[c.length - 1].endMinute <= segment.startMinute)
				if (col) {
					col.push(segment)
					segment.slot = columns.indexOf(col)
				} else {
					segment.slot = columns.length
					columns.push([segment])
				}
			}

			const totalCols = columns.length

			for (const segment of cluster) {
				segment.total = totalCols
				segment.span = 1
				for (let i = segment.slot! + 1; i < totalCols; i++) {
					const col = columns[i]
					if (col.some(s => s.overlapsWith(segment))) break
					segment.span++
				}
			}
		}

		return sorted
	}

	static clusterMonth(segments: Array<EventSegment>) {
		if (!segments?.length) {
			return []
		}

		const segmentsByEvent = new Map<CalendarEvent, EventSegment[]>()
		for (const segment of segments) {
			const arr = segmentsByEvent.get(segment.event) || []
			arr.push(segment)
			segmentsByEvent.set(segment.event, arr)
		}

		const uniqueEvents = Array.from(segmentsByEvent.keys())

		const sortedEvents = uniqueEvents.sort((a, b) => {
			if (!a.start || !b.start || !a.end || !b.end) return 0

			const aIsMultiDay = !a.start.dayStart.equals(a.end.dayStart)
			const bIsMultiDay = !b.start.dayStart.equals(b.end.dayStart)

			if (aIsMultiDay && !bIsMultiDay) return -1
			if (!aIsMultiDay && bIsMultiDay) return 1

			if (a.start.isBefore(b.start)) return -1
			if (a.start.isAfter(b.start)) return 1

			if (a.end.isAfter(b.end)) return -1
			if (a.end.isBefore(b.end)) return 1
			return 0
		})

		const rows = new Array<Array<CalendarEvent>>()

		for (const event of sortedEvents) {
			const eventSegments = segmentsByEvent.get(event)!
			let placed = false
			for (let i = 0; i < rows.length; i++) {
				const row = rows[i]
				
				const overlaps = row.some(rowEvent => {
					const rowEventSegments = segmentsByEvent.get(rowEvent)!
					return rowEventSegments.some(rs => 
						!!rs.segmentDate && eventSegments.some(es => !!es.segmentDate && es.segmentDate.equals(rs.segmentDate))
					)
				})

				if (!overlaps) {
					row.push(event)
					eventSegments.forEach(s => s.monthSlot = i)
					placed = true
					break
				}
			}
			if (!placed) {
				eventSegments.forEach(s => s.monthSlot = rows.length)
				rows.push([event])
			}
		}

		return segments
	}
}
