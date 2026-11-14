/**
 * Dates of a routine kept in a row: a missed or cancelled one ends it, as it counts against `kept`. What it holds are the kept
 * dates, the first of which it runs since.
 */
export class RoutineStreak<T> {
	/** Every streak along `dates`, the settled ones in order, the last running to the last of them: empty after a miss. */
	static along<T>(dates: ReadonlyArray<T>, kept: (date: T) => boolean) {
		const streaks = new Array<RoutineStreak<T>>()
		let current = new RoutineStreak<T>([])
		for (const date of dates) {
			if (kept(date)) {
				current = new RoutineStreak([...current.dates, date])
			} else if (!current.out) {
				streaks.push(current)
				current = new RoutineStreak<T>([])
			}
		}
		return dates.length ? [...streaks, current] : []
	}

	private constructor(
		/** The kept dates, in order. */
		readonly dates: ReadonlyArray<T>,
	) { }

	/** How many dates it kept. */
	get length() {
		return this.dates.length
	}

	/** Whether it ended at the last date, which was missed. */
	get out() {
		return !this.dates.length
	}

	/** Its first kept date. */
	get since() {
		return this.dates[0]
	}
}
