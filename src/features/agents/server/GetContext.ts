import { description, label } from '@a11d/metadata'
import { EntryType } from '#features/entries'
import { TimeZone } from '#features/time/TimeZone.js'
import type { IntegrationClass } from '#integrations'
import { operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { tool } from './tool.js'

const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

/** How the user reads dates: the locale, its calendar and week, and today in both the wire's form and the user's own. */
function readingOf(locale: Intl.Locale, zone: TimeZone) {
	const week = (locale as Intl.Locale & { getWeekInfo(): { firstDay: number, weekend: Array<number> } }).getWeekInfo()
	const now = new Date()
	return {
		locale: String(locale),
		calendar: new Intl.DateTimeFormat(locale, { timeZone: zone.id }).resolvedOptions().calendar,
		weekStart: weekdays[week.firstDay - 1],
		weekend: week.weekend.map(day => weekdays[day - 1]),
		today: {
			date: zone.dayOf(now).toString(),
			label: new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: zone.id }).format(now),
		},
	}
}

@operation()
@label('Calendar context')
@description('Call this first. Answers the current time and the home time zone times are read in where an entry names none; how the user reads dates (their locale, its calendar and week, and today as they write it), so speak dates in their calendar while the tools take ISO dates; the integrations calendars live in, with the user\'s own addresses there; and the calendars with what each can hold, which writes it takes, and the types it takes when create_entry names no calendar. A field a calendar does not hold cannot be set on its entries. Then get_overview gives what is going on in a day or a week. Words used throughout: a task\'s schedule is its start and end; its due date and estimate are constraints apart from the schedule; an unscheduled task has no start; a moment is a start without an end.')
@tool({ name: 'get_context', annotations: { readOnlyHint: true } })
export class GetContext extends Operation {
	async run({ em, user }: OperationContext) {
		const zone = user.timeZones?.home?.zone ?? TimeZone.UTC
		const integrations = await user.integrations(em)
		const sources = await user.sources(em, { enabled: true })
		const defaults = await Promise.all(EntryType.all.map(async type => ({ type, sourceId: (await user.defaultCalendar(em, type).catch(() => undefined))?.source.id })))
		return {
			now: Temporal.Now.zonedDateTimeISO(zone.id).toString({ timeZoneName: 'never', smallestUnit: 'minute' }),
			homeTimeZone: zone.id,
			...readingOf(new Intl.Locale(user.settings?.locale ?? 'en'), zone),
			integrations: integrations.map(integration => ({
				id: integration.id,
				name: integration.title,
				provider: (integration.constructor as IntegrationClass).label,
				addresses: integration.addresses ?? [],
				can: { createCalendars: integration.capabilities.sources.create },
			})),
			calendars: sources.map(source => {
				const integration = integrations.find(each => each.id === source.integrationId)!
				const { entries } = integration.capabilitiesFor(source)
				return {
					id: source.id,
					name: source.name,
					integrationId: integration.id,
					provider: (integration.constructor as IntegrationClass).label,
					holdsTypes: source.supportedEntryTypes.filter(type => integration.canHold(source, type)).map(type => type.value),
					defaultFor: defaults.filter(each => each.sourceId === source.id).map(each => each.type.value),
					can: { create: entries.create, edit: entries.edit, delete: entries.delete, attach: entries.attach, deleteCalendar: integration.capabilitiesFor(source).sources.delete },
					holdsFields: [...integration.ownership.ownedBy('upstream'), ...integration.ownership.ownedBy('mitra')].filter(field => field !== 'rank'),
				}
			}),
		}
	}
}
