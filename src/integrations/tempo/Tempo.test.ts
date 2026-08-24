import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Tempo, type TempoIssue, type TempoWorklog } from './Tempo.js'
import { Entry } from '../../features/entries/Entry.js'
import { EntryType } from '../../features/entries/EntryType.js'
import { Integration } from '../Integration.js'

const issue: TempoIssue = { key: 'ACME-1234', summary: 'Fix the parser' }
const BERLIN = 'Europe/Berlin'
const projects = ['ACME', 'NOVA', 'ORBIT']
const isProjectKey = (project: string) => projects.includes(project)

const worklog = (init?: Partial<TempoWorklog>): TempoWorklog => ({
	tempoWorklogId: 42,
	issue: { id: 10001 },
	timeSpentSeconds: 3600,
	startDate: '2026-08-03',
	startTime: '09:34:00',
	description: 'Refactoring',
	updatedAt: '2026-08-03T09:00:00Z',
	...init,
})

describe('Tempo ticket keys', () => {
	it('finds the key wherever it sits in the title', () => {
		for (const [heading, expected] of [
			['ACME-1234 standup', 'ACME-1234'],
			['Work on ACME-1234', 'ACME-1234'],
			['Meeting re acme-1234', 'ACME-1234'],
			['ACME-1234: pairing', 'ACME-1234'],
			['(NOVA-14026) review', 'NOVA-14026'],
		] as const) {
			assert.equal(Tempo.findIssueKey(heading, isProjectKey), expected, heading)
		}
	})

	it('is not derailed by hyphenated words that merely look like keys', () => {
		assert.equal(Tempo.findIssueKey('Fix the COVID-19 chart for ACME-1234', isProjectKey), 'ACME-1234')
		assert.equal(Tempo.findIssueKey('Read up on ISO-8601', isProjectKey), undefined)
		assert.equal(Tempo.findIssueKey('Refactoring', isProjectKey), undefined)
	})

	it('takes the first of several keys, in reading order', () => {
		assert.equal(Tempo.findIssueKey('ACME-9588, ACME-9589 & other topics', isProjectKey), 'ACME-9588')
		// The first CANDIDATE isn't necessarily the first real key.
		assert.equal(Tempo.findIssueKey('UTF-8 issues in NOVA-14026', isProjectKey), 'NOVA-14026')
	})

	it('accepts any candidate when no project list is at hand', () => {
		assert.equal(Tempo.findIssueKey('Read up on ISO-8601'), 'ISO-8601')
	})
})

describe('Tempo worklog text', () => {
	it('titles an entry with the issue it books against, not the worklog note', () => {
		// The note is usually a bare activity label, and one worklog in six carries text Jira wrote
		// itself ("Working on work item ACME-1234") — as a title it says the least of anything available.
		assert.equal(Tempo.headingFor(issue, 10001), 'ACME-1234 Fix the parser')
	})

	it('falls back to the bare key, then to the id, when Jira says less', () => {
		assert.equal(Tempo.headingFor({ key: 'ACME-1234', summary: '' }, 10001), 'ACME-1234')
		assert.equal(Tempo.headingFor(undefined, 10001), '#10001')
	})

	it('keeps the key in the title, which is the only thing a duplicate carries its ticket in', () => {
		// Entry.duplicate drops `data`, so a copy booked from this heading must still name its issue.
		const heading = Tempo.headingFor(issue, 10001)
		assert.equal(Tempo.findIssueKey(heading, isProjectKey), 'ACME-1234')
	})

	it('finds the issue even when the summary names another ticket', () => {
		const heading = Tempo.headingFor({ key: 'ACME-1234', summary: 'Fix the regression from NOVA-99' }, 10001)
		assert.equal(Tempo.findIssueKey(heading, isProjectKey), 'ACME-1234')
	})
})

describe('Tempo times', () => {
	it('reads a wall clock in the account zone, not as UTC', () => {
		// Reading it as UTC is what shifted every worklog by the viewer's own offset.
		const start = Tempo.startOf({ startDate: '2026-08-03', startTime: '09:34:00' }, BERLIN)
		assert.equal(start.toISOString(), '2026-08-03T07:34:00.000Z')
	})

	it('writes back the wall clock the user sees, not the UTC face of the instant', () => {
		// The reported bug: an entry placed at 22:30 in Berlin was booked at 20:30 in Tempo.
		const instant = new Date('2026-08-24T20:30:00Z')
		assert.deepEqual(Tempo.dateTimeOf(instant, BERLIN), { startDate: '2026-08-24', startTime: '22:30:00' })
	})

	it('defaults a worklog with no start time to midnight in that zone', () => {
		assert.equal(Tempo.startOf({ startDate: '2026-08-03' }, BERLIN).toISOString(), '2026-08-02T22:00:00.000Z')
	})

	it('round-trips a wall clock through an instant, on both sides of a DST change', () => {
		for (const [startDate, startTime] of [['2026-08-03', '09:34:00'], ['2026-01-15', '09:34:00'], ['2026-10-25', '01:30:00']] as const) {
			const instant = Tempo.startOf({ startDate, startTime }, BERLIN)
			assert.deepEqual(Tempo.dateTimeOf(instant, BERLIN), { startDate, startTime }, `${startDate} ${startTime}`)
		}
	})

	it('falls back to a fixed reading for an account whose Jira profile named no zone', () => {
		assert.equal(Tempo.zoneOf({ credentials: { timeZone: '' } }), 'UTC')
		assert.equal(Tempo.zoneOf({ credentials: { timeZone: BERLIN } }), BERLIN)
	})

	it('measures a duration that crosses midnight', () => {
		const entry = new Entry({ start: new Date('2026-08-03T23:00:00Z') as never, end: new Date('2026-08-04T01:30:00Z') as never })
		assert.equal(Tempo.secondsOf(entry), 2.5 * 3600)
	})

	it('answers zero for an entry with no span, so a caller must refuse it', () => {
		assert.equal(Tempo.secondsOf(new Entry({})), 0)
	})
})

describe('Tempo entry mapping', () => {
	it('decodes a worklog onto an entry', () => {
		const entry = new Entry({ sourceId: 's1' })
		Tempo.applyWorklog(entry, worklog(), issue, 'https://acme.atlassian.net', BERLIN)

		assert.equal(entry.uri, '42')
		assert.equal(entry.type, EntryType.Event)
		assert.equal(entry.heading, 'ACME-1234 Fix the parser')
		assert.equal(entry.description, 'Refactoring')
		assert.equal(entry.allDay, false)
		assert.equal(entry.timeZone, BERLIN)
		assert.equal((entry.start as unknown as Date).toISOString(), '2026-08-03T07:34:00.000Z')
		assert.equal((entry.end as unknown as Date).toISOString(), '2026-08-03T08:34:00.000Z')
		assert.equal(entry.data?.url, 'https://acme.atlassian.net/browse/ACME-1234')
		assert.equal(entry.data?.etag, '2026-08-03T09:00:00Z')
	})

	it('clears what Tempo cannot hold, so a migrated row keeps nothing of its old provider', () => {
		const entry = new Entry({ sourceId: 's1', location: 'Berlin', reminders: [30], description: 'notes' })
		Tempo.applyWorklog(entry, worklog(), issue, 'https://acme.atlassian.net', BERLIN)

		assert.equal(entry.location, '')
		assert.equal(entry.reminders, null)
		assert.equal(entry.participants, null)
		assert.equal(entry.recurrence, null)
	})

	it('leaves no link when the issue never resolved', () => {
		const entry = new Entry({ sourceId: 's1' })
		Tempo.applyWorklog(entry, worklog(), undefined, 'https://acme.atlassian.net', BERLIN)
		assert.equal(entry.data?.url, undefined)
		assert.equal(entry.heading, '#10001')
		assert.equal(entry.description, 'Refactoring')
	})

	it('keeps the whole worklog as the base a diff-scoped write starts from', () => {
		const entry = new Entry({ sourceId: 's1' })
		const stored = worklog({ billableSeconds: 1800, attributes: { values: [{ key: '_Category_', value: 'Coding' }] } })
		Tempo.applyWorklog(entry, stored, issue, 'https://acme.atlassian.net', BERLIN)

		assert.deepEqual(Tempo.storedWorklogOf(entry), stored)
	})

	it('survives an entry whose raw data is missing or unreadable', () => {
		assert.equal(Tempo.storedWorklogOf(new Entry({})), undefined)
		assert.equal(Tempo.storedWorklogOf(new Entry({ data: { raw: 'not json' } })), undefined)
	})
})

describe('Tempo integration', () => {
	it('normalizes whatever shape of site URL was pasted', () => {
		for (const [typed, expected] of [
			['https://acme.atlassian.net', 'https://acme.atlassian.net'],
			['https://acme.atlassian.net/', 'https://acme.atlassian.net'],
			['acme.atlassian.net', 'https://acme.atlassian.net'],
			['  acme.atlassian.net// ', 'https://acme.atlassian.net'],
			['', ''],
		] as const) {
			assert.equal(Tempo.normalizeSite(typed), expected, typed)
		}
	})

	it('builds a browse link off a site with or without its trailing slash', () => {
		assert.equal(Tempo.browseUrl('https://acme.atlassian.net/', 'ACME-1'), 'https://acme.atlassian.net/browse/ACME-1')
	})

	it('reads the account back out of a source uri', () => {
		const accountId = 'acct:0000-1111'
		assert.equal(Tempo.accountIdOf({ uri: Tempo.sourceUri(accountId) }), accountId)
		assert.throws(() => Tempo.accountIdOf({ uri: 'notion://ds/view' }), /Not a Tempo source uri/)
	})

	it('needs both credentials and the site before a connect may be attempted', () => {
		const credentials = { username: '', site: 'https://acme.atlassian.net', token: 't', jiraEmail: 'a@b.c', jiraToken: 'j', timeZone: BERLIN }
		assert.equal(new Tempo({ credentials }).canConnect, true)
		for (const missing of ['site', 'token', 'jiraEmail', 'jiraToken'] as const) {
			assert.equal(new Tempo({ credentials: { ...credentials, [missing]: '' } }).canConnect, false, missing)
		}
	})

	it('keeps a stored secret when the edit form leaves it blank, and takes a retyped one', () => {
		const stored = new Tempo({ credentials: { username: 'Alice', site: 'https://acme.atlassian.net', token: 'tempo-old', jiraEmail: 'a@b.c', jiraToken: 'jira-old', timeZone: BERLIN } })
		stored.merge(new Tempo({ credentials: { username: '', site: '', token: '', jiraEmail: '', jiraToken: 'jira-new', timeZone: 'Pacific/Auckland' } }))

		assert.equal(stored.credentials.token, 'tempo-old')
		assert.equal(stored.credentials.jiraToken, 'jira-new')
		assert.equal(stored.credentials.site, 'https://acme.atlassian.net')
		// The label and the zone are discovery's to set, never the form's.
		assert.equal(stored.credentials.username, 'Alice')
		assert.equal(stored.credentials.timeZone, BERLIN)
	})

	it('declares what a worklog cannot be, and that mitra may write one', () => {
		const capabilities = new Tempo().capabilities
		for (const off of ['recurrence', 'reminders', 'location', 'timeZone', 'participants', 'allDay', 'relations', 'renameEntries'] as const) {
			assert.equal(capabilities[off], false, off)
		}
		// The note is editable; the title is the issue's and therefore not ours to rename.
		assert.equal(capabilities.description, true)
		for (const on of ['createEntries', 'editEntries', 'deleteEntries'] as const) {
			assert.equal(capabilities[on], true, on)
		}
	})

	it('points its external link at the Jira issue', () => {
		const entry = new Entry({ data: { url: 'https://acme.atlassian.net/browse/ACME-1' } })
		assert.deepEqual(new Tempo().externalLink(entry), { url: 'https://acme.atlassian.net/browse/ACME-1', label: 'Jira' })
		assert.equal(new Tempo().externalLink(new Entry({})), undefined)
	})
})

describe('external links in general', () => {
	it('names the provider an entry can be opened at', () => {
		const entry = new Entry({ data: { url: 'https://www.notion.so/page' } })
		class Acme extends Integration {
			static readonly label = 'Acme'
			override merge() { }
		}
		assert.deepEqual(new Acme().externalLink(entry), { url: 'https://www.notion.so/page', label: 'Acme' })
	})

	it('refuses a URL that is not https, whatever the provider sent', () => {
		// The URL is synced data, so a scheme check here is what keeps it from being an execution vector.
		for (const url of ['javascript:alert(1)', 'data:text/html,<script>', 'http://acme.test/x', 'not a url', '']) {
			assert.equal(Integration.externalUrlOf(new Entry({ data: { url } })), undefined, url)
		}
		assert.equal(Integration.externalUrlOf(new Entry({})), undefined)
	})
})
