import { converter } from '@a11d/converter'
import { model } from '../../infrastructure/model/model.js'
import { Integration, integration, withheld } from '../Integration.js'
import { type Entry } from '../../features/entries/Entry.js'
import { EntryType } from '../../features/entries/EntryType.js'
import { type TempoClient } from './server/TempoClient.js'
import { type JiraClient } from './server/JiraClient.js'

export interface TempoCredentials {
	username: string
	site: string
	token: string
	jiraEmail: string
	jiraToken: string
	timeZone: string
}

/** Wire representation of a worklog as served by Tempo REST API v4. */
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

export interface TempoIssue {
	key: string
	summary: string
}

/**
 * Integration for Tempo Timesheets on Jira.
 * Maps individual logged work intervals to timed calendar events.
 */
@model('Tempo')
@integration('tempo')
export class Tempo extends Integration<TempoCredentials> {
	static readonly label: string = 'Tempo'
	static readonly logo: string = 'tempo'
	static readonly description: string = 'The hours you book on Jira issues'

	static readonly uriPrefix = 'tempo://'

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

	static normalizeSite(site: string | undefined): string {
		const trimmed = (site ?? '').trim().replace(/\/+$/, '')
		if (!trimmed) {
			return ''
		}
		return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`
	}

	@converter(withheld<TempoCredentials>('token', 'jiraToken')) override credentials!: TempoCredentials

	@converter({ out: {} }) client?: TempoClient
	@converter({ out: {} }) jiraClient?: JiraClient

	constructor(init?: Partial<Tempo>) {
		super()
		this.credentials = { username: '', site: '', token: '', jiraEmail: '', jiraToken: '', timeZone: '' }
		Object.assign(this, init)
	}

	override toString() {
		return `Tempo integration for "${this.credentials.username || this.uri || '(new)'}"`
	}

	override get capabilities() {
		return {
			...Integration.fullCapabilities,
			recurrence: false, reminders: false, location: false, cancelledStatus: false,
			percentComplete: false, timeZone: false, participants: false, transparency: false,
			visibility: false, relations: false, allDay: false, renameEntries: false,
		}
	}

	override externalLink(entry: Entry) {
		const url = Integration.externalUrlOf(entry)
		return !url ? undefined : { url, label: 'Jira' }
	}

	override get canConnect() {
		return !!this.credentials.site && !!this.credentials.token && !!this.credentials.jiraEmail && !!this.credentials.jiraToken
	}

	override get syncInterval() { return 60_000 }

	override merge(incoming: this) {
		this.credentials = {
			username: this.credentials.username ?? '',
			site: Tempo.normalizeSite(incoming.credentials?.site) || this.credentials.site,
			token: incoming.credentials?.token || this.credentials.token,
			jiraEmail: incoming.credentials?.jiraEmail || this.credentials.jiraEmail,
			jiraToken: incoming.credentials?.jiraToken || this.credentials.jiraToken,
			timeZone: this.credentials.timeZone ?? '',
		}
	}

	// --- Mapping (pure, static — the tested surface) ------------------------------------------------

	private static readonly issueKeyPattern = /\b[A-Za-z][A-Za-z0-9_]*-\d+\b/g

	/**
	 * Resolves the issue key candidate from a heading matching configured project keys.
	 */
	static findIssueKey(heading: string, isProjectKey?: (project: string) => boolean): string | undefined {
		const candidates = (heading.match(Tempo.issueKeyPattern) ?? []).map(candidate => candidate.toUpperCase())
		return candidates.find(candidate => !isProjectKey || isProjectKey(candidate.slice(0, candidate.lastIndexOf('-'))))
	}

	static headingFor(issue: TempoIssue | undefined, issueId: number): string {
		if (!issue) {
			return `#${issueId}`
		}
		return issue.summary ? `${issue.key} ${issue.summary}` : issue.key
	}

	/**
	 * Computes the UTC start Date instant from a Tempo worklog's naive wall-clock date/time and the account's time zone.
	 */
	static startOf(worklog: Pick<TempoWorklog, 'startDate' | 'startTime'>, zone: string): Date {
		const wallClock = Temporal.PlainDateTime.from(`${worklog.startDate}T${worklog.startTime || '00:00:00'}`)
		return new Date(wallClock.toZonedDateTime(zone).epochMilliseconds)
	}

	static dateTimeOf(instant: Date, zone: string): { startDate: string, startTime: string } {
		const zoned = Temporal.Instant.fromEpochMilliseconds(instant.getTime()).toZonedDateTimeISO(zone)
		return { startDate: zoned.toPlainDate().toString(), startTime: zoned.toPlainTime().toString({ smallestUnit: 'second' }) }
	}

	static zoneOf(integration: { credentials: Pick<TempoCredentials, 'timeZone'> }): string {
		return integration.credentials.timeZone || 'UTC'
	}

	static secondsOf(entry: Entry): number {
		const start = entry.start ? new Date(entry.start as unknown as Date).getTime() : undefined
		const end = entry.end ? new Date(entry.end as unknown as Date).getTime() : undefined
		return start === undefined || end === undefined ? 0 : Math.round((end - start) / 1000)
	}

	/** Decodes a worklog into an Entry event. */
	static applyWorklog(entry: Entry, worklog: TempoWorklog, issue: TempoIssue | undefined, siteUrl: string, zone: string): void {
		const start = Tempo.startOf(worklog, zone)
		entry.uri = String(worklog.tempoWorklogId)
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
			...(issue ? { url: Tempo.browseUrl(siteUrl, issue.key) } : {}),
		}
	}

	static browseUrl(siteUrl: string, issueKey: string): string {
		return `${siteUrl.replace(/\/+$/, '')}/browse/${issueKey}`
	}

	/** Returns the raw worklog JSON parsed from entry data, if available. */
	static storedWorklogOf(entry: Entry): TempoWorklog | undefined {
		try {
			return entry.data?.raw ? JSON.parse(entry.data.raw) as TempoWorklog : undefined
		} catch {
			return undefined
		}
	}
}
