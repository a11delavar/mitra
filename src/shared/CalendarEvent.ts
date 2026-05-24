import { DateTime } from '@3mo/date-time'
import { EventSegment } from './EventSegment.js'

export class CalendarEvent {
	id = Math.random().toString(36).substring(2, 9)
	heading = ''
	color?: string
	start!: DateTime
	end!: DateTime

	constructor(init?: Partial<CalendarEvent>) {
		Object.assign(this, init)
	}

	get segments(): EventSegment[] {
		if (!this.start || !this.end) return [new EventSegment(this)]

		const start = this.start
		const end = this.end

		const startDay = start.dayStart
		const endDay = end.dayStart

		if (startDay.equals(endDay) || (end.hour === 0 && end.minute === 0 && startDay.equals(endDay.subtract({ days: 1 })))) {
			return [new EventSegment(this, { segmentDate: startDay })]
		}

		const segments = new Array<EventSegment>()
		let currentDay = startDay

		while (currentDay.isBefore(endDay) || (currentDay.equals(endDay) && (end.hour > 0 || end.minute > 0))) {
			const dayEnd = currentDay.add({ days: 1 })

			segments.push(new EventSegment(this, {
				segmentDate: currentDay,
				continuedFromPrevious: start.isBefore(currentDay),
				continuesNext: end.isAfter(dayEnd),
			}))

			currentDay = dayEnd
		}

		return segments
	}

	get allDay() {
		return this.start && this.end
			&& this.start.hour === 0 && this.start.minute === 0
			&& this.end.hour === 0 && this.end.minute === 0
	}
}
