import { fetchIntegrations, getUser, putIntegrationOrder, putSourceOrder, restoreSourceVisibility, soloSource } from '../../../infrastructure/http/Api.js'
import { applyOrder, byOrder } from '../../../infrastructure/model/order.js'
import { Integration } from '../../../integrations/Integration.js'
import { IntegrationCapabilities } from '../../../integrations/IntegrationCapabilities.js'
import { IntegrationOwnership } from '../../../integrations/IntegrationOwnership.js'
import { type Source } from '../Source.js'
import { type EntryType } from '../../entries/EntryType.js'
import { type Entry } from '../../entries/Entry.js'

/** The user's calendars as this device knows them: the integrations and their sources, what each can hold and what it allows. */
export class Calendars {
	private static all = new Array<Integration>()

	/** Loads them in the user's order, each integration's sources too. */
	static async fetch() {
		Calendars.adopt(await fetchIntegrations())
	}

	static adopt(integrations: Array<Integration>) {
		for (const integration of integrations) {
			integration.sources = [...integration.sources].sort(byOrder) as unknown as Integration['sources']
		}
		Calendars.all = integrations.sort(byOrder)
	}

	static get integrations(): Array<Integration> {
		return [...Calendars.all]
	}

	static get sources(): Array<Source> {
		return Calendars.all.flatMap(integration => [...integration.sources])
	}

	/** Where entries can live. Unlike the visible ones, these include hidden calendars. */
	static enabled(integration?: Integration): Array<Source> {
		return (integration ? [...integration.sources] : Calendars.sources).filter(source => source.enabled)
	}

	static get visible(): Array<Source> {
		return Calendars.sources.filter(source => source.visible)
	}

	static source(id: string) {
		return Calendars.sources.find(source => source.id === id)
	}

	static integrationOf(sourceId: string) {
		return Calendars.all.find(integration => [...integration.sources].some(source => source.id === sourceId))
	}

	/** The id of the calendar the user chose as default, if any. */
	static get defaultId(): string | undefined {
		return getUser()?.defaultSourceId ?? undefined
	}

	/** Where a new entry goes: the default calendar while visible and able to hold `type`, else the first that is. */
	static primary(type?: EntryType): Source | undefined {
		const candidates = Calendars.visible.filter(source => !type || Calendars.canHold(source, type))
		return candidates.find(source => source.id === Calendars.defaultId) ?? candidates[0]
	}

	/** The provider's capabilities, with writes off for a read-only source. */
	static capabilitiesOf(sourceId: string): IntegrationCapabilities {
		return (Calendars.integrationOf(sourceId)?.capabilities ?? new IntegrationCapabilities()).in(Calendars.source(sourceId))
	}

	/** Which fields the source's entries hold, and who owns each. */
	static ownershipOf(sourceId: string): IntegrationOwnership {
		return Calendars.integrationOf(sourceId)?.ownership ?? new IntegrationOwnership()
	}

	/** Whether entries of `type` can live in `source`, which for availability also takes the provider's say. */
	static canHold(source: Source, type: EntryType) {
		return Calendars.integrationOf(source.id)?.canHold(source, type) ?? source.supportsEntryType(type)
	}

	/** Where an entry can be opened outside Mitra, if anywhere. */
	static externalLinkOf(entry: Entry): { url: string, label?: string } | undefined {
		const url = Integration.externalUrlOf(entry)
		return Calendars.integrationOf(entry.sourceId)?.externalLink?.(entry) ?? (url ? { url } : undefined)
	}

	static canCopyEntriesOut(source: Source) {
		return Calendars.enabled().some(other => other.id !== source.id && Calendars.capabilitiesOf(other.id).entries.create)
	}

	static canMoveEntriesOut(source: Source) {
		return Calendars.canCopyEntriesOut(source) && Calendars.capabilitiesOf(source.id).entries.delete
	}

	static reorderSources(integration: Integration, ids: Array<string>) {
		const sources = [...integration.sources]
		applyOrder(sources, ids)
		integration.sources = sources.sort(byOrder) as unknown as Integration['sources']
		return putSourceOrder(ids)
	}

	static reorderIntegrations(ids: Array<string>) {
		applyOrder(Calendars.all, ids)
		Calendars.all.sort(byOrder)
		return putIntegrationOrder(ids)
	}

	/** Shows this calendar alone, remembering what was visible before. */
	static async solo(sourceId: string) {
		await soloSource(sourceId)
		await Calendars.fetch()
	}

	/** Whether a solo is on, which `restoreVisibility` ends. */
	static get canRestoreVisibility() {
		return !!getUser()?.previouslyHiddenSourceIds
	}

	static async restoreVisibility() {
		await restoreSourceVisibility()
		await Calendars.fetch()
	}
}
