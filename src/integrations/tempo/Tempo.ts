import { converter } from '@a11d/converter'
import { model } from '../../infrastructure/model/model.js'
import { Integration, integration, withheld } from '../Integration.js'
import { type Entry } from '../../features/entries/Entry.js'
import { EntryType } from '../../features/entries/EntryType.js'
import { type TempoClient } from './server/TempoClient.js'
import { type JiraClient } from './server/JiraClient.js'

export interface TempoCredentials {
	/** The Atlassian account's e-mail — what the sidebar titles the integration with. Resolved at
	 * discovery (see the sync engine), never taken from the client. */
	username: string
	/** The Atlassian site the worklogs and issues live on, e.g. `https://acme.atlassian.net` — the
	 * integration's `uri` is the Jira ACCOUNT (discovered), so the site travels here. */
	site: string
	/** Tempo's own API token (Tempo → Settings → Data Access → API integration). */
	token: string
	/** The Atlassian account the Jira token belongs to — Jira's REST API authenticates as
	 * `email:token`, unlike Tempo's bearer. */
	jiraEmail: string
	/** An Atlassian API token (id.atlassian.com → Security). Tempo's token is rejected by Jira and
	 * vice versa: they are separate products behind separate credentials. */
	jiraToken: string
	/** The Jira profile's time zone — discovered like {@link username}, never typed. A worklog's
	 * `startDate`/`startTime` carry no zone of their own, and this is the one they mean: it is what
	 * Tempo's own UI shows them in. Without it a wall clock could only be read as UTC, which silently
	 * shifts every worklog by the reader's offset (see {@link startOf}). */
	timeZone: string
}

/** A worklog as the Tempo REST API v4 serves it — only the fields mitra maps. */
export interface TempoWorklog {
	tempoWorklogId: number
	issue: { id: number }
	timeSpentSeconds: number
	billableSeconds?: number
	startDate: string
	startTime?: string
	description?: string
	updatedAt?: string
	attributes?: { values?: Array<{ key: string, value: unknown }> }
	author?: { accountId: string }
}

/** What a worklog's issue is called, once Jira has resolved its numeric id. */
export interface TempoIssue {
	key: string
	summary: string
}

/**
 * Tempo Timesheets (the Jira time-tracking app): each worklog — seconds of work on a Jira issue, on a
 * date — mirrors as one timed entry.
 *
 * Two credentials, because two products: Tempo's API knows a worklog's issue ONLY as a numeric id and
 * has no "who am I" endpoint, while every write needs both an `authorAccountId` and an issue id. Jira
 * answers both (`/myself`, `issue/bulkfetch`) and rejects Tempo's token, so a Tempo connection without
 * a Jira one could neither name a ticket nor book against one.
 */
@model('Tempo')
@integration('tempo')
export class Tempo extends Integration<TempoCredentials> {
	static readonly label: string = 'Tempo'
	static readonly logo: string = 'tempo'
	static readonly description: string = 'The hours you book on Jira issues'

	static readonly uriPrefix = 'tempo://'

	/** Tempo is one timesheet per person, so an account has exactly one source — its identity is the
	 * Jira account the tokens act as, which is also the integration's own (see fetchSources). */
	static sourceUri(accountId: string): string {
		return `${Tempo.uriPrefix}${accountId}/worklogs`
	}

	static accountIdOf(source: { uri: string }): string {
		const accountId = source.uri.startsWith(Tempo.uriPrefix) ? source.uri.slice(Tempo.uriPrefix.length).split('/')[0] : undefined
		if (!accountId) {
			throw new Error(`Not a Tempo source uri: ${source.uri}`)
		}
		return accountId
	}

	/** People paste a site with a path, a trailing slash, or no scheme at all; every URL built from it
	 * (Jira's REST base, an issue's browse link) assumes exactly one shape. */
	static normalizeSite(site: string | undefined): string {
		const trimmed = (site ?? '').trim().replace(/\/+$/, '')
		if (!trimmed) {
			return ''
		}
		return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`
	}

	@converter(withheld<TempoCredentials>('token', 'jiraToken')) override credentials!: TempoCredentials

	/** Transient, like {@link CalDAV.client}: `out: {}` keeps live connections off the wire. Memoized
	 * per INTEGRATION rather than on the engine, which is a singleton shared by every account. */
	@converter({ out: {} }) client?: TempoClient
	@converter({ out: {} }) jiraClient?: JiraClient

	constructor(init?: Partial<Tempo>) {
		super()
		// This provider's own blank credential shape — see CalDAV's constructor for the why (bind/undefined).
		this.credentials = { username: '', site: '', token: '', jiraEmail: '', jiraToken: '', timeZone: '' }
		Object.assign(this, init)
	}

	override toString() {
		return `Tempo integration for "${this.credentials.username || this.uri || '(new)'}"`
	}

	/**
	 * A worklog is a duration on a day, a note, and the issue it books against — nothing else mitra
	 * models: no place, no invitees, no repeat (Tempo books each day separately), no task status.
	 *
	 * The two texts are what shape the rest: the ISSUE's summary is the title (what the entry is about,
	 * and Jira's fact — hence `renameEntries: false`), the worklog's own description is the editable
	 * note (`description: true`). Tempo's own UI draws exactly this pair, summary above note.
	 * `timeZone: false` because `startDate`/`startTime` are wall clock with no zone at all (see
	 * {@link startOf}), and `allDay: false` because seconds on a day cannot mean "all day".
	 */
	override get capabilities() {
		return {
			...Integration.fullCapabilities,
			recurrence: false, reminders: false, location: false, cancelledStatus: false,
			percentComplete: false, timeZone: false, participants: false, transparency: false,
			visibility: false, relations: false, allDay: false, renameEntries: false,
		}
	}

	/** The destination is the ISSUE, in Jira: Tempo's own UI has no stable per-worklog URL. */
	override externalLink(entry: Entry) {
		const url = Integration.externalUrlOf(entry)
		return !url ? undefined : { url, label: 'Jira' }
	}

	// Both tokens plus the site: Tempo identifies the worklogs, Jira the person and the issues.
	override get canConnect() {
		return !!this.credentials.site && !!this.credentials.token && !!this.credentials.jiraEmail && !!this.credentials.jiraToken
	}

	/** Tempo asks for a second between requests and a sync spends two or three, so one poll a minute
	 * keeps several connected accounts comfortably inside that (like Notion and Google). */
	override get syncInterval() { return 60_000 }

	override merge(incoming: this) {
		this.credentials = {
			// Discovery derives the label from Jira, never the form.
			username: this.credentials.username ?? '',
			site: Tempo.normalizeSite(incoming.credentials?.site) || this.credentials.site,
			// A blank incoming secret keeps the stored one — the edit form leaves both empty.
			token: incoming.credentials?.token || this.credentials.token,
			jiraEmail: incoming.credentials?.jiraEmail || this.credentials.jiraEmail,
			jiraToken: incoming.credentials?.jiraToken || this.credentials.jiraToken,
			// Discovered, like the label.
			timeZone: this.credentials.timeZone ?? '',
		}
	}

	// --- Mapping (pure, static — the tested surface) ------------------------------------------------

	/** Jira's default project key is uppercase letters, but the format is configurable to digits and
	 * underscores — so this deliberately over-matches (and accepts lower case, since people type it):
	 * {@link findIssueKey} decides which candidate is real by asking the project list. */
	private static readonly issueKeyPattern = /\b[A-Za-z][A-Za-z0-9_]*-\d+\b/g

	/**
	 * The ticket a heading books against: the FIRST candidate anywhere in the line whose project part
	 * is one this Jira actually has — so "Work on ACME-1234" books like "ACME-1234 standup" does, while
	 * "Fix the COVID-19 chart for ACME-1234" is not derailed by a hyphenated word that merely looks
	 * like a key.
	 *
	 * `isProjectKey` is asked rather than assumed because that is the only thing separating a key from
	 * any other hyphenated token. Absent (no project list at hand), any candidate is accepted and the
	 * resolve rejects an invented one — a worse message, but never a wrong booking.
	 */
	static findIssueKey(heading: string, isProjectKey?: (project: string) => boolean): string | undefined {
		const candidates = (heading.match(Tempo.issueKeyPattern) ?? []).map(candidate => candidate.toUpperCase())
		return candidates.find(candidate => !isProjectKey || isProjectKey(candidate.slice(0, candidate.lastIndexOf('-'))))
	}

	/**
	 * What a worklog is ABOUT: its issue, which is the useful thing to read on a chip and the only
	 * thing that distinguishes one ticket's hours from another's. The worklog's own description is a
	 * separate, editable note ({@link applyWorklog}) rather than part of this line — it is usually a
	 * bare activity label ("Review"), and one worklog in six carries text Jira wrote itself ("Working
	 * on work item ACME-1234"), so as a title it says the least of anything available.
	 *
	 * The key stays in the line for two reasons beyond reading: {@link findIssueKey} parses it back out
	 * when a copy of this entry is booked, and `Entry.duplicate` drops `data`, so the heading is the
	 * only thing a duplicate carries its ticket in.
	 */
	static headingFor(issue: TempoIssue | undefined, issueId: number): string {
		if (!issue) {
			return `#${issueId}`
		}
		return issue.summary ? `${issue.key} ${issue.summary}` : issue.key
	}
	/**
	 * A worklog's start as an instant. `startDate`/`startTime` are a bare wall clock — Tempo stores no
	 * zone, and start times are an optional instance feature many leave off (every row of such a day
	 * then carries the same 08:00 default) — so the zone has to come from the account: the Jira
	 * profile's, which is the one Tempo's own UI renders them in.
	 *
	 * Deliberately NOT mitra's FLOATING marker, even though a zone-less wall clock is exactly what that
	 * means: a floating entry is stored as-if-UTC and rendered as a plain instant, so every worklog
	 * would show — and be written back — shifted by the viewer's own offset. An instant in a known
	 * zone round-trips exactly and renders correctly for any viewer.
	 */
	static startOf(worklog: Pick<TempoWorklog, 'startDate' | 'startTime'>, zone: string): Date {
		const wallClock = Temporal.PlainDateTime.from(`${worklog.startDate}T${worklog.startTime || '00:00:00'}`)
		return new Date(wallClock.toZonedDateTime(zone).epochMilliseconds)
	}

	/** The wall-clock halves of an instant in `zone`, as Tempo spells them — the mirror of {@link startOf}. */
	static dateTimeOf(instant: Date, zone: string): { startDate: string, startTime: string } {
		const zoned = Temporal.Instant.fromEpochMilliseconds(instant.getTime()).toZonedDateTimeISO(zone)
		return { startDate: zoned.toPlainDate().toString(), startTime: zoned.toPlainTime().toString({ smallestUnit: 'second' }) }
	}

	/** The zone a worklog's wall clock is written in. `UTC` only stands in for an account whose Jira
	 * profile named none — an arbitrary reading, but a FIXED one, so reads and writes still agree. */
	static zoneOf(integration: { credentials: Pick<TempoCredentials, 'timeZone'> }): string {
		return integration.credentials.timeZone || 'UTC'
	}

	/** How long an entry books for. Tempo stores whole seconds, and a worklog of no length is not a
	 * thing the API accepts, so a dateless or zero-length entry is a caller error, not a 0. */
	static secondsOf(entry: Entry): number {
		const start = entry.start ? new Date(entry.start as unknown as Date).getTime() : undefined
		const end = entry.end ? new Date(entry.end as unknown as Date).getTime() : undefined
		return start === undefined || end === undefined ? 0 : Math.round((end - start) / 1000)
	}

	/** Decodes a worklog onto an entry, clearing what Tempo cannot hold so a row migrated from another
	 * provider keeps nothing of it. No `localWriteAt` stamp, unlike Notion: deletions here come from an
	 * explicit audit feed rather than a set difference, so a just-written row needs no shielding. */
	static applyWorklog(entry: Entry, worklog: TempoWorklog, issue: TempoIssue | undefined, siteUrl: string, zone: string): void {
		const start = Tempo.startOf(worklog, zone)
		entry.uri = String(worklog.tempoWorklogId)
		// Assigning the type is a CONVERSION (it clears what only the other kind can hold — see Entry),
		// so an entry already of this kind must not be re-assigned: the clear writes `undefined` where a
		// stored row reads `null`, and every re-serve would then compare as an edit.
		if (!entry.type?.isEvent) {
			entry.type = EntryType.Event
		}
		entry.heading = Tempo.headingFor(issue, worklog.issue.id)
		entry.description = worklog.description ?? ''
		entry.location = ''
		entry.allDay = false
		entry.timeZone = zone
		entry.start = start as never
		entry.end = new Date(start.getTime() + worklog.timeSpentSeconds * 1000) as never
		entry.percentComplete = null
		entry.recurrence = null
		entry.reminders = null
		entry.participants = null
		entry.transparency = null
		entry.visibility = null
		entry.data = {
			raw: JSON.stringify(worklog),
			etag: worklog.updatedAt,
			// Only a resolved key can be browsed to; an unresolved one leaves no link rather than a 404.
			...(issue ? { url: Tempo.browseUrl(siteUrl, issue.key) } : {}),
		}
	}

	static browseUrl(siteUrl: string, issueKey: string): string {
		return `${siteUrl.replace(/\/+$/, '')}/browse/${issueKey}`
	}

	/** The worklog an entry was last synced from — the base a diff-scoped write starts from, so the
	 * fields mitra never shows (billable seconds, work attributes) survive a full-replace PUT. */
	static storedWorklogOf(entry: Entry): TempoWorklog | undefined {
		try {
			return entry.data?.raw ? JSON.parse(entry.data.raw) as TempoWorklog : undefined
		} catch {
			return undefined
		}
	}
}
