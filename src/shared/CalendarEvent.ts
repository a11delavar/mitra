import { DateTime, DateTimeRange } from '@3mo/date-time'

export class CalendarEvent {
	id = Math.random().toString(36).substring(2, 9)
	heading = ''
	color?: string
	range!: DateTimeRange
	continuesNext?: boolean
	continuedFromPrevious?: boolean

	slot?: number
	total?: number
	span?: number
	monthSlot?: number
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
			return [new CalendarEvent({ ...this, segmentDate: startDay, monthSlot: this.monthSlot })]
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
				continuesNext: isCrossNext,
				monthSlot: this.monthSlot,
			}))

			currentDay = dayEnd
		}

		return items
	}

	get duration() {
		return this.endMinute - this.startMinute
	}

	get allDay() {
		const { start, end } = this.range || {}
		if (!start || !end) { return false }
		return start.hour === 0 && start.minute === 0 && end.hour === 0 && end.minute === 0
	}

	get isTimed() {
		// Multi-day events (segments continued across boundaries) are rendered horizontally at the top, like all-day events.
		if (this.continuedFromPrevious || this.continuesNext) return false

		// If an event starts exactly at 00:00 and ends exactly at 00:00, it is treated as an "All Day" event.
		// These events do not have a specific duration during the day, so they are not "timed".
		if (this.allDay) return false

		return true
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

	static cluster(events: Array<CalendarEvent>) {
		if (!events?.length) {
			return []
		}

		const sorted = [...events].sort((a, b) => a.compareTo(b))

		const clusters: Array<Array<CalendarEvent>> = []
		let currentCluster = new Array<CalendarEvent>()
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
			const columns = new Array<CalendarEvent[]>()

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

	overlapsDaysWith(other: CalendarEvent) {
		return this.items.some(item => !!item.segmentDate && other.fallsOnDay(item.segmentDate))
	}

	static clusterMonth(events: Array<CalendarEvent>) {
		if (!events?.length) {
			return []
		}

		const sorted = [...events].sort((a, b) => {
			if (!a.range?.start || !b.range?.start || !a.range?.end || !b.range?.end) return 0

			const aIsMultiDay = !a.range.start.dayStart.equals(a.range.end.dayStart)
			const bIsMultiDay = !b.range.start.dayStart.equals(b.range.end.dayStart)

			if (aIsMultiDay && !bIsMultiDay) return -1
			if (!aIsMultiDay && bIsMultiDay) return 1

			if (a.range.start.isBefore(b.range.start)) return -1
			if (a.range.start.isAfter(b.range.start)) return 1

			if (a.range.end.isAfter(b.range.end)) return -1
			if (a.range.end.isBefore(b.range.end)) return 1
			return 0
		})

		const rows = new Array<Array<CalendarEvent>>()

		for (const event of sorted) {
			let placed = false
			for (let i = 0; i < rows.length; i++) {
				const row = rows[i]
				if (!row.some(e => e.overlapsDaysWith(event))) {
					row.push(event)
					event.monthSlot = i
					placed = true
					break
				}
			}
			if (!placed) {
				event.monthSlot = rows.length
				rows.push([event])
			}
		}

		return sorted
	}
}
