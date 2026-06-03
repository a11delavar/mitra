import { DateTime } from '@3mo/date-time'
import { type Express } from 'express'
import { CalDAV, Source, SourceType, Entry, EntryType } from '../shared/index.js'

const BLUE = '#51ace3'
const GREEN = '#63d18d'
const AMBER = '#f9c344'
const PURPLE = '#9b61f9'
const RED = '#eb5a5a'

class SampleIntegration extends CalDAV {
	readonly eventSource = new Source({
		id: 'dev-sample-events', integrationId: this.id, uri: 'https://sample.local/calendar',
		type: SourceType.Event, name: 'Sample Calendar', color: BLUE, enabled: true, hidden: false,
	})

	readonly taskSource = new Source({
		id: 'dev-sample-tasks', integrationId: this.id, uri: 'https://sample.local/calendar',
		type: SourceType.Task, name: 'Sample Calendar', color: PURPLE, enabled: true, hidden: false,
	})

	// Integration models `sources` as a MikroORM Collection, whose mutation needs registered entity
	// metadata this never-persisted fake lacks. A plain array serialises identically — and is exactly
	// what the client revives `sources` into anyway — so we just replace it.
	override sources = [this.eventSource, this.taskSource] as unknown as CalDAV['sources']

	readonly entries = SampleIntegration.buildEntries(this.eventSource.id, this.taskSource.id)

	constructor() {
		super({ id: 'dev-sample-integration', userId: 'dev', type: 'caldav', uri: 'https://sample.local', credentials: { username: 'dev', password: '' } })
	}

	/** This integration's entries overlapping [start, end]. */
	entriesInRange(start: string, end: string): ReadonlyArray<Entry> {
		const [from, to] = [new Date(start).valueOf(), new Date(end).valueOf()]
		return this.entries.filter(entry => entry.start && entry.end && entry.start.valueOf() <= to && entry.end.valueOf() >= from)
	}

	private static buildEntries(eventSourceId: string, taskSourceId: string): ReadonlyArray<Entry> {
		const weekStart = new DateTime().weekStart.dayStart
		const at = (day: number, hour: number, minute = 0) => weekStart.add({ days: day }).with({ hour, minute })
		const allDay = (day: number) => weekStart.add({ days: day }) // midnight → genuinely all-day
		const event = (init: Partial<Entry>) => new Entry({ ...init, sourceId: eventSourceId, type: EntryType.Event })
		const task = (init: Partial<Entry>) => new Entry({ ...init, sourceId: taskSourceId, type: EntryType.Task })

		return [
			// Monday
			event({ heading: 'Standup', color: BLUE, start: at(0, 9), end: at(0, 9, 15) }),
			event({ heading: '1:1 with Sarah', color: GREEN, start: at(0, 9, 30), end: at(0, 10) }),
			event({ heading: 'Sprint Planning', color: BLUE, start: at(0, 10), end: at(0, 11, 30) }),
			event({ heading: 'Team Lunch', color: AMBER, start: at(0, 12, 30), end: at(0, 13, 30) }),
			event({ heading: 'Design Review', color: GREEN, start: at(0, 14), end: at(0, 15) }),
			// Tuesday — Deep Work and Client Call overlap
			event({ heading: 'Standup', color: BLUE, start: at(1, 9), end: at(1, 9, 15) }),
			event({ heading: 'Deep Work', color: BLUE, start: at(1, 10), end: at(1, 12) }),
			event({ heading: 'Client Call', color: RED, start: at(1, 11), end: at(1, 11, 30) }),
			event({ heading: 'Gym', color: GREEN, start: at(1, 18), end: at(1, 19) }),
			// Wednesday
			event({ heading: 'Standup', color: BLUE, start: at(2, 9), end: at(2, 9, 15) }),
			event({ heading: 'Architecture Sync', color: BLUE, start: at(2, 11), end: at(2, 12) }),
			event({ heading: 'Lunch w/ Alex', color: AMBER, start: at(2, 12, 30), end: at(2, 13, 30) }),
			event({ heading: 'Interview: Frontend', color: GREEN, start: at(2, 15), end: at(2, 16) }),
			// Thursday — Standup overlaps the Focus Block
			event({ heading: 'Focus Block', color: BLUE, start: at(3, 9), end: at(3, 12) }),
			event({ heading: 'Standup', color: RED, start: at(3, 9), end: at(3, 9, 15) }),
			event({ heading: 'Product Demo', color: GREEN, start: at(3, 14), end: at(3, 15) }),
			// Friday
			event({ heading: 'Standup', color: BLUE, start: at(4, 9), end: at(4, 9, 15) }),
			event({ heading: 'Sprint Retro', color: AMBER, start: at(4, 15), end: at(4, 16) }),
			event({ heading: 'Happy Hour', color: GREEN, start: at(4, 17), end: at(4, 18, 30) }),

			// All-day & multi-day (all-day lane + month spanning; Berlin Trip crosses into next week)
			event({ heading: 'Conference', color: GREEN, start: allDay(1), end: allDay(4) }),
			event({ heading: 'Public Holiday', color: RED, start: allDay(4), end: allDay(5) }),
			event({ heading: 'Berlin Trip', color: BLUE, start: allDay(5), end: allDay(10) }),

			// Tasks, mid-day (some already done)
			task({ heading: 'Submit expense report', color: PURPLE, done: true, start: at(0, 11), end: at(0, 11, 30) }),
			task({ heading: 'Review PR #312', color: PURPLE, start: at(1, 13), end: at(1, 13, 30) }),
			task({ heading: 'Update roadmap doc', color: PURPLE, start: at(2, 14), end: at(2, 14, 30) }),
			task({ heading: 'Prepare demo slides', color: PURPLE, start: at(3, 12), end: at(3, 13) }),
			task({ heading: 'Send weekly update', color: PURPLE, done: true, start: at(4, 11, 30), end: at(4, 12) }),
		]
	}
}

/**
 * Dev-only: appends the sample integration and its in-range entries to the real GET responses (wrapping
 * `res.json` so the real DB query still runs). Read-only — the samples aren't in the DB, so edits/deletes
 * fall through to the real routes and 404.
 */
export function mountDevFixture(app: Express) {
	const sample = new SampleIntegration()

	app.use('/api/integrations', (req, res, next) => {
		if (req.method === 'GET' && req.path === '/') {
			const json = res.json.bind(res)
			res.json = (body: any) => Array.isArray(body) ? json([...body, sample]) : json(body)
		}
		next()
	})

	app.use('/api/entries', (req, res, next) => {
		const { start, end } = req.query as { start?: string, end?: string }
		if (req.method === 'GET' && req.path === '/' && start && end) {
			const extra = sample.entriesInRange(start, end)
			const json = res.json.bind(res)
			res.json = (body: any) => Array.isArray(body) ? json([...body, ...extra]) : json(body)
		}
		next()
	})
}
