import type { EntryType, Entry } from '#features/entries'
import { Integration, IntegrationCapabilities, IntegrationOwnership } from '#integrations'
import { fetchIntegrations, getUser, putIntegrationOrder, putSourceOrder, restoreSourceVisibility, soloSource, toggleSourceVisibility } from '#infrastructure/http/Api.js'
import { applyOrder, byOrder } from '#infrastructure/model'
import { type Source } from '../Source.js'

/** The user's calendars as this device knows them: the integrations and their sources, what each can hold and what it allows. */
export class Calendars {
	private static all = new Array<Integration>()

	/** Fires `show` once {@link show} has shown a hidden calendar, for the calendar to fetch its entries. */
	static readonly shown = new EventTarget()

	/** Loads them in the user's order, each integration's sources too. */
	static async fetch() {
		Calendars.adopt(await fetchIntegrations())
	}

	static adopt(integrations: Array<Integration>) {
		for (const integration of integrations) {
			integration.sources = [...integration.sources].sort(byOrder)
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
		integration.sources = sources.sort(byOrder)
		return putSourceOrder(ids)
	}

	static reorderIntegrations(ids: Array<string>) {
		applyOrder(Calendars.all, ids)
		Calendars.all.sort(byOrder)
		return putIntegrationOrder(ids)
	}

	static async setHidden(source: Source, hidden: boolean) {
		await toggleSourceVisibility(source.id, hidden)
		source.hidden = hidden
	}

	/** Shows the calendar if it is hidden, as an entry opens only where it renders. */
	static async show(sourceId: string) {
		const source = Calendars.source(sourceId)
		if (source?.hidden) {
			await Calendars.setHidden(source, false)
			Calendars.shown.dispatchEvent(new Event('show'))
		}
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
