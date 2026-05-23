import { CalendarEvent } from './CalendarEvent.js'

const weekStart = new DateTime().weekStart
const startOf = (dayIndex: number, h: number, m: number) => weekStart.add({ days: dayIndex }).with({ hour: h, minute: m, second: 0, millisecond: 0 })

export const sampleEvents = [
	// Tuesday
	new CalendarEvent({ range: new DateTimeRange(startOf(1, 9, 0), startOf(1, 10, 30)), heading: "Design Sync", color: "#51ace3" }),
	new CalendarEvent({ range: new DateTimeRange(startOf(1, 9, 30), startOf(1, 11, 0)), heading: "Review PRs", color: "#51ace3" }),
	new CalendarEvent({ range: new DateTimeRange(startOf(1, 10, 0), startOf(1, 11, 30)), heading: "1:1 with Alex", color: "#63d18d" }),
	new CalendarEvent({ range: new DateTimeRange(startOf(1, 10, 30), startOf(1, 12, 0)), heading: "Planning", color: "#f9c344" }),
	// Wednesday
	new CalendarEvent({ range: new DateTimeRange(startOf(2, 14, 0), startOf(2, 17, 0)), heading: "Deep Work", color: "#51ace3" }),
	new CalendarEvent({ range: new DateTimeRange(startOf(2, 14, 0), startOf(2, 15, 30)), heading: "Urgent Fix", color: "#51ace3" }),
	new CalendarEvent({ range: new DateTimeRange(startOf(2, 14, 0), startOf(2, 14, 45)), heading: "Quick Call", color: "#51ace3" }),
	// Thursday
	new CalendarEvent({ range: new DateTimeRange(startOf(3, 10, 15), startOf(3, 11, 45)), heading: "PGIT Seminar", color: "#f9c344" }),
	new CalendarEvent({ range: new DateTimeRange(startOf(3, 12, 15), startOf(3, 13, 45)), heading: "SEW Exercise", color: "#f9c344" }),
	new CalendarEvent({ range: new DateTimeRange(startOf(3, 12, 30), startOf(3, 15, 0)), heading: "Bedroom Cleanup", color: "#9b61f9" }),
	// CROSS DAY EVENT (Thursday 22:00 -> Friday 03:00)
	new CalendarEvent({ range: new DateTimeRange(startOf(3, 22, 0), startOf(4, 3, 0)), heading: "Hackathon", color: "#f9c344" }),
	// Friday
	new CalendarEvent({ range: new DateTimeRange(startOf(4, 8, 0), startOf(4, 9, 0)), heading: "Morning Run", color: "#9b61f9" }),
	new CalendarEvent({ range: new DateTimeRange(startOf(4, 8, 30), startOf(4, 9, 30)), heading: "Breakfast", color: "#9b61f9" }),
	new CalendarEvent({ range: new DateTimeRange(startOf(4, 18, 0), startOf(4, 20, 0)), heading: "Movie Night", color: "#9b61f9" }),
	new CalendarEvent({ range: new DateTimeRange(startOf(4, 19, 0), startOf(4, 21, 0)), heading: "Dinner", color: "#9b61f9" })
]