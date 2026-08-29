import { type EntityManager } from '@mikro-orm/sqlite'
import { Source } from '../../../features/sources/Source.js'
import { Entry } from '../../../features/entries/Entry.js'
import { EntryType } from '../../../features/entries/EntryType.js'
import { Color } from '../../../features/sources/Color.js'
import { createLogger } from '../../../infrastructure/logging/Logger.js'
import type { Integration, SyncEngine } from '../../Integration.js'
import { Tempo, type TempoIssue } from '../Tempo.js'
import { TempoClient, TempoRequestError, type TempoWorklogInput } from './TempoClient.js'
import { JiraClient } from './JiraClient.js'

const logger = createLogger('Tempo')

interface TempoSyncState {
	updatedFrom?: string
	issues?: Record<string, TempoIssue>
	projectKeys?: Array<string>
}

/**
 * Sync engine implementation for Tempo Timesheets and Jira Cloud.
 */
export class TempoSyncEngine implements SyncEngine {
	private static readonly watermarkOverlapMs = 60_000

	private tempo(integration: Tempo): TempoClient {
		return integration.client ??= new TempoClient(integration.credentials.token)
	}

	private jira(integration: Tempo): JiraClient {
		return integration.jiraClient ??= new JiraClient(integration.credentials.site, integration.credentials.jiraEmail, integration.credentials.jiraToken)
	}

	// --- Discovery --------------------------------------------------------------------------------

	async fetchSources(integration: Integration): Promise<Array<Source>> {
		const tempo = integration as Tempo
		await this.tempo(tempo).globalConfiguration().catch(error => {
			throw new Error(`Tempo rejected the API token: ${error instanceof Error ? error.message : error}`)
		})
		const me = await this.jira(tempo).myself().catch(error => {
			throw new Error(`Jira rejected the e-mail and API token: ${error instanceof Error ? error.message : error}`)
		})

		tempo.uri = `${Tempo.uriPrefix}${me.accountId}`
		tempo.credentials = {
			...tempo.credentials,
			username: me.emailAddress || tempo.credentials.jiraEmail || me.displayName || 'Tempo',
			timeZone: me.timeZone || 'UTC',
		}

		const uri = Tempo.sourceUri(me.accountId)
		return [new Source({
			uri,
			name: 'My worklogs',
			entryTypes: [EntryType.Event],
			color: Color.get(uri).value,
			enabled: false,
		})]
	}

	// --- Sync -------------------------------------------------------------------------------------

	async syncSourceEntries(integration: Integration, em: EntityManager, source: Source): Promise<boolean> {
		const tempo = integration as Tempo
		const client = this.tempo(tempo)
		const accountId = Tempo.accountIdOf(source)
		const state = (source.syncState ?? {}) as TempoSyncState
		const since = state.updatedFrom ? new Date(Date.parse(state.updatedFrom) - TempoSyncEngine.watermarkOverlapMs).toISOString() : undefined

		const worklogs = await client.searchWorklogs(accountId, since)
		const existing = await em.find(Entry, { sourceId: source.id })
		const existingByUri = new Map(existing.map(entry => [entry.uri, entry]))
		let changed = false

		if (since) {
			for (const deleted of await client.deletedWorklogs(since)) {
				const entry = existingByUri.get(String(deleted.tempoWorklogId))
				if (entry) {
					em.remove(entry)
					changed = true
				}
			}
		}

		const issues = await this.resolveIssues(tempo, source, worklogs.map(worklog => worklog.issue.id))

		for (const worklog of worklogs) {
			const entry = existingByUri.get(String(worklog.tempoWorklogId))
			const before = entry?.clone()
			const target = entry ?? new Entry({ id: crypto.randomUUID(), sourceId: source.id })
			if (!entry) {
				em.persist(target)
			}
			Tempo.applyWorklog(target, worklog, issues.get(String(worklog.issue.id)), tempo.credentials.site, Tempo.zoneOf(tempo))
			if (!before || !before.editEquals(target)) {
				changed = true
			}
		}

		const newest = worklogs.map(worklog => worklog.updatedAt).filter(Boolean).sort().at(-1)
		if (newest && (!state.updatedFrom || newest > state.updatedFrom)) {
			source.syncState = { ...source.syncState, updatedFrom: newest }
		}

		logger.debug(`Synced "${source.name}": ${worklogs.length} worklog(s)${changed ? '' : ' (no local changes)'}`)
		return changed
	}

	/**
	 * Resolves issue metadata for unmapped issue IDs and caches results in source syncState.
	 */
	private async resolveIssues(integration: Tempo, source: Source, issueIds: Array<number>): Promise<Map<string, TempoIssue>> {
		const state = (source.syncState ?? {}) as TempoSyncState
		const known = new Map(Object.entries(state.issues ?? {}))
		const missing = [...new Set(issueIds.map(String))].filter(id => !known.has(id))
		if (missing.length) {
			try {
				for (const [key, issue] of await this.jira(integration).issues(missing)) {
					if (/^\d+$/.test(key)) {
						known.set(key, { key: issue.key, summary: issue.summary })
					}
				}
				source.syncState = { ...source.syncState, issues: Object.fromEntries(known) }
			} catch (error) {
				logger.warn(`Could not resolve ${missing.length} issue name(s) — their entries stay labelled by id: ${error instanceof Error ? error.message : error}`)
			}
		}
		return known
	}

	private async projectKeys(integration: Tempo, source: Source, refresh: boolean): Promise<Array<string>> {
		const state = (source.syncState ?? {}) as TempoSyncState
		if (state.projectKeys?.length && !refresh) {
			return state.projectKeys
		}
		try {
			const keys = await this.jira(integration).projectKeys()
			source.syncState = { ...source.syncState, projectKeys: keys }
			return keys
		} catch (error) {
			logger.warn(`Could not read the Jira project list — falling back to accepting any ticket-shaped word: ${error instanceof Error ? error.message : error}`)
			return state.projectKeys ?? []
		}
	}

	// --- Entry CRUD -------------------------------------------------------------------------------

	async createEntry(integration: Integration, em: EntityManager, entry: Entry): Promise<Entry> {
		const tempo = integration as Tempo
		const source = await em.findOneOrFail(Source, { id: entry.sourceId })
		const seconds = Tempo.secondsOf(entry)
		if (!seconds) {
			throw new Error('A worklog needs a start and a duration')
		}

		const key = await this.findIssueKey(tempo, source, entry.heading)
		const resolved = await this.jira(tempo).issues([key])
		const issue = resolved.get(key)
		if (!issue) {
			throw new Error(`Jira has no issue ${key}`)
		}

		const { startDate, startTime } = Tempo.dateTimeOf(new Date(entry.start as unknown as Date), Tempo.zoneOf(tempo))
		const worklog = await this.tempo(tempo).createWorklog({
			issueId: Number(issue.id),
			authorAccountId: Tempo.accountIdOf(source),
			startDate,
			startTime,
			timeSpentSeconds: seconds,
			description: entry.description || entry.heading,
		})
		this.rememberIssue(source, worklog.issue.id, issue)
		Tempo.applyWorklog(entry, worklog, issue, tempo.credentials.site, Tempo.zoneOf(tempo))
		em.persist(entry)
		return entry
	}

	async updateEntry(integration: Integration, em: EntityManager, existing: Entry, incoming: Entry): Promise<void> {
		const tempo = integration as Tempo
		if (!existing.uri) {
			throw new Error('Entry has no Tempo worklog id')
		}
		const source = await em.findOneOrFail(Source, { id: existing.sourceId })
		const stored = Tempo.storedWorklogOf(existing)
		if (!stored) {
			throw new Error('This worklog has not been synced yet — re-import the source and try again')
		}
		const issue = ((source.syncState ?? {}) as TempoSyncState).issues?.[String(stored.issue.id)]

		const seconds = Tempo.secondsOf(incoming)
		if (!seconds) {
			throw new Error('A worklog needs a start and a duration')
		}
		const { startDate, startTime } = Tempo.dateTimeOf(new Date(incoming.start as unknown as Date), Tempo.zoneOf(tempo))

		const input: TempoWorklogInput = {
			authorAccountId: stored.author?.accountId ?? Tempo.accountIdOf(source),
			startDate,
			startTime,
			timeSpentSeconds: seconds,
			...(stored.billableSeconds === undefined ? {} : { billableSeconds: stored.billableSeconds }),
			...(stored.attributes?.values?.length ? { attributes: stored.attributes.values } : {}),
			description: incoming.description ?? '',
		}
		const worklog = await this.tempo(tempo).updateWorklog(existing.uri, input)
		Tempo.applyWorklog(existing, worklog, issue, tempo.credentials.site, Tempo.zoneOf(tempo))
	}

	async deleteEntry(integration: Integration, em: EntityManager, entry: Entry): Promise<void> {
		if (entry.uri) {
			try {
				await this.tempo(integration as Tempo).deleteWorklog(entry.uri)
			} catch (error) {
				if (!(error instanceof TempoRequestError) || error.status !== 404) {
					throw error
				}
			}
		}
		em.remove(entry)
	}

	excludeOccurrence(): Promise<void> {
		return Promise.reject(new Error('Tempo worklogs cannot repeat'))
	}

	private async findIssueKey(integration: Tempo, source: Source, heading: string): Promise<string> {
		for (const refresh of [false, true]) {
			const keys = new Set(await this.projectKeys(integration, source, refresh))
			const key = Tempo.findIssueKey(heading, keys.size ? project => keys.has(project) : undefined)
			if (key) {
				return key
			}
		}
		throw new Error(`No Jira ticket in "${heading}" — start the title with a ticket key, e.g. ACME-1234`)
	}

	private rememberIssue(source: Source, issueId: number, issue: TempoIssue): void {
		const state = (source.syncState ?? {}) as TempoSyncState
		source.syncState = { ...source.syncState, issues: { ...state.issues, [String(issueId)]: { key: issue.key, summary: issue.summary } } }
	}
}
