import { DateTime, DateTimeRange } from '@3mo/date-time'

export class CalendarEvent {
	heading = ''
	color?: string
	range!: DateTimeRange
	continuesNext?: boolean
	continuedFromPrevious?: boolean

	slot?: number
	total?: number
	span?: number
	segmentDate?: DateTime

	constructor(init?: Partial<CalendarEvent>) {
		Object.assign(this, init)
	}

	get startMinute() {
		if (this.continuedFromPrevious) return 1
		return this.range?.start ? this.range.start.hour * 60 + this.range.start.minute + 1 : 1
	}

	get endMinute() {
		if (this.continuesNext) return 1441
		return this.range?.end ? this.range.end.hour * 60 + this.range.end.minute + 1 : 2
	}

	get items(): CalendarEvent[] {
		if (!this.range?.start || !this.range?.end) return [this]

		const start = this.range.start
		const end = this.range.end

		const startDay = start.dayStart
		const endDay = end.dayStart

		if (startDay.equals(endDay) || (end.hour === 0 && end.minute === 0 && startDay.equals(endDay.subtract({ days: 1 })))) {
			return [this]
		}

		const items = new Array<CalendarEvent>()
		let currentDay = startDay

		while (currentDay.isBefore(endDay) || (currentDay.equals(endDay) && (end.hour > 0 || end.minute > 0))) {
			const dayEnd = currentDay.add({ days: 1 })

			const isCrossPrevious = start.isBefore(currentDay)
			const isCrossNext = end.isAfter(dayEnd)

			items.push(new CalendarEvent({
				...this,
				segmentDate: currentDay,
				continuedFromPrevious: isCrossPrevious,
				continuesNext: isCrossNext
			}))

			currentDay = dayEnd
		}

		return items
	}

	get duration() {
		return this.endMinute - this.startMinute
	}

	compareTo(other: CalendarEvent) {
		if (this.startMinute !== other.startMinute) {
			return this.startMinute - other.startMinute
		}
		return other.duration - this.duration
	}

	overlapsWith(other: CalendarEvent) {
		return Math.max(this.startMinute, other.startMinute) < Math.min(this.endMinute, other.endMinute)
	}

	fallsOnDay(date: DateTime) {
		const dayStart = date.dayStart

		if (this.segmentDate) {
			return this.segmentDate.dayStart.equals(dayStart)
		}

		const start = this.range?.start
		const dayEnd = dayStart.add({ days: 1 })
		return !!start && (start.equals(dayStart) || start.isAfter(dayStart)) && start.isBefore(dayEnd)
	}

	static cluster(events: CalendarEvent[]): CalendarEvent[] {
		if (!events || events.length === 0) return []

		const sorted = [...events].sort((a, b) => a.compareTo(b))

		const clusters: CalendarEvent[][] = []
		let currentCluster: CalendarEvent[] = []
		let clusterEnd = -1

		for (const event of sorted) {
			if (currentCluster.length === 0 || event.startMinute < clusterEnd) {
				currentCluster.push(event)
				clusterEnd = Math.max(clusterEnd, event.endMinute)
			} else {
				clusters.push(currentCluster)
				currentCluster = [event]
				clusterEnd = event.endMinute
			}
		}
		if (currentCluster.length > 0) {
			clusters.push(currentCluster)
		}

		for (const cluster of clusters) {
			const columns: CalendarEvent[][] = []

			for (const event of cluster) {
				const col = columns.find(c => c[c.length - 1].endMinute <= event.startMinute)
				if (col) {
					col.push(event)
					event.slot = columns.indexOf(col)
				} else {
					event.slot = columns.length
					columns.push([event])
				}
			}

			const totalCols = columns.length

			for (const event of cluster) {
				event.total = totalCols
				event.span = 1
				for (let i = event.slot! + 1; i < totalCols; i++) {
					const col = columns[i]
					if (col.some(e => e.overlapsWith(event))) break
					event.span++
				}
			}
		}

		return sorted
	}
}
