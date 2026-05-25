import { Entry } from './Entry.js'

const weekStart = new DateTime().weekStart
const startOf = (dayIndex: number, h: number, m: number) => weekStart.add({ days: dayIndex }).with({ hour: h, minute: m, second: 0, millisecond: 0 })

export const sampleEntries = [
	// Tuesday
	new Entry({ start: startOf(1, 9, 0), end: startOf(1, 10, 30), heading: "Design Sync", color: "#51ace3" }),
	new Entry({ start: startOf(1, 9, 30), end: startOf(1, 11, 0), heading: "Review PRs", color: "#51ace3" }),
	new Entry({ start: startOf(1, 10, 0), end: startOf(1, 11, 30), heading: "1:1 with Alex", color: "#63d18d" }),
	new Entry({ start: startOf(1, 10, 30), end: startOf(1, 12, 0), heading: "Planning", color: "#f9c344" }),
	// Wednesday
	new Entry({ start: startOf(2, 14, 0), end: startOf(2, 17, 0), heading: "Deep Work", color: "#51ace3" }),
	new Entry({ start: startOf(2, 14, 0), end: startOf(2, 15, 30), heading: "Urgent Fix", color: "#51ace3" }),
	new Entry({ start: startOf(2, 14, 0), end: startOf(2, 14, 45), heading: "Quick Call", color: "#51ace3" }),
	// Thursday
	new Entry({ start: startOf(3, 10, 15), end: startOf(3, 11, 45), heading: "PGIT Seminar", color: "#f9c344" }),
	new Entry({ start: startOf(3, 12, 15), end: startOf(3, 13, 45), heading: "SEW Exercise", color: "#f9c344" }),
	new Entry({ start: startOf(3, 12, 30), end: startOf(3, 15, 0), heading: "Bedroom Cleanup", color: "#9b61f9" }),
	// CROSS DAY EVENT (Thursday 22:00 -> Friday 03:00)
	new Entry({ start: startOf(3, 22, 0), end: startOf(4, 3, 0), heading: "Hackathon", color: "#f9c344" }),
	// Friday
	new Entry({ start: startOf(4, 8, 0), end: startOf(4, 9, 0), heading: "Morning Run", color: "#9b61f9" }),
	new Entry({ start: startOf(4, 8, 30), end: startOf(4, 9, 30), heading: "Breakfast", color: "#9b61f9" }),
	new Entry({ start: startOf(4, 18, 0), end: startOf(4, 20, 0), heading: "Movie Night", color: "#9b61f9" }),
	new Entry({ start: startOf(4, 19, 0), end: startOf(4, 21, 0), heading: "Dinner", color: "#9b61f9" })
]