import { Migration } from '@mikro-orm/migrations'
import ICAL from 'ical.js'

const parts = ['recurrence_freq', 'recurrence_interval', 'recurrence_byday', 'recurrence_bymonthday', 'recurrence_count', 'recurrence_until']

interface Row {
	readonly id: string
	readonly recurrence_freq: string
	readonly recurrence_interval: number | null
	readonly recurrence_byday: string | null
	readonly recurrence_bymonthday: number | null
	readonly recurrence_count: number | null
	readonly recurrence_until: number | null
	readonly data: string | null
}

/**
 * Keeps an entry's rule as its RRULE in one `recurrence` column, where six held the parts Mitra edits. A synced entry
 * takes its whole RRULE and its EXDATEs from its stored .ics, so it no longer needs the file to repeat. An override's
 * link to its recurring entry is named for it: `recurring_entry_id`, once `recurrence_master_id`.
 */
export class Migration20261014210517_RecurrenceAsRule extends Migration {
	override async up() {
		await this.execute('alter table `entry` add column `recurrence` text null;')
		const rows = await this.execute(`select \`id\`, ${parts.map(part => `\`${part}\``).join(', ')}, \`data\` from \`entry\` where \`recurrence_freq\` is not null;`) as Array<Row>
		for (const row of rows) {
			const synced = Migration20261014210517_RecurrenceAsRule.syncedRule(row)
			await this.execute('update `entry` set `recurrence` = ?, `exdates` = coalesce(?, `exdates`) where `id` = ?;', [
				synced?.rrule ?? Migration20261014210517_RecurrenceAsRule.ruleOf(row),
				synced?.exdates.length ? JSON.stringify(synced.exdates) : null,
				row.id,
			])
		}
		for (const part of parts) {
			await this.execute(`alter table \`entry\` drop column \`${part}\`;`)
		}
		await this.execute('alter table `entry` rename column `recurrence_master_id` to `recurring_entry_id`;')
	}

	override async down() {
		await this.execute('alter table `entry` rename column `recurring_entry_id` to `recurrence_master_id`;')
		for (const [column, type] of [['recurrence_freq', 'text'], ['recurrence_interval', 'integer'], ['recurrence_byday', 'json'], ['recurrence_bymonthday', 'integer'], ['recurrence_count', 'integer'], ['recurrence_until', 'datetime']]) {
			await this.execute(`alter table \`entry\` add column \`${column}\` ${type} null;`)
		}
		const rows = await this.execute('select `id`, `recurrence` from `entry` where `recurrence` is not null;') as Array<{ id: string, recurrence: string }>
		for (const { id, recurrence } of rows) {
			const rule = Object.fromEntries(recurrence.split(';').map(part => part.split('=')))
			const until = /^(\d{4})(\d{2})(\d{2})/.exec(rule.UNTIL ?? '')
			await this.execute('update `entry` set `recurrence_freq` = ?, `recurrence_interval` = ?, `recurrence_byday` = ?, `recurrence_bymonthday` = ?, `recurrence_count` = ?, `recurrence_until` = ? where `id` = ?;', [
				rule.FREQ,
				rule.INTERVAL ? Number(rule.INTERVAL) : null,
				rule.BYDAY ? JSON.stringify(rule.BYDAY.split(',')) : null,
				/^\d+$/.test(rule.BYMONTHDAY ?? '') ? Number(rule.BYMONTHDAY) : null,
				rule.COUNT ? Number(rule.COUNT) : null,
				until ? Date.UTC(Number(until[1]), Number(until[2]) - 1, Number(until[3])) : null,
				id,
			])
		}
		await this.execute('alter table `entry` drop column `recurrence`;')
	}

	private static ruleOf(row: Row) {
		const rule = [`FREQ=${row.recurrence_freq}`]
		if (row.recurrence_interval && row.recurrence_interval > 1) {
			rule.push(`INTERVAL=${row.recurrence_interval}`)
		}
		const byday = row.recurrence_byday ? JSON.parse(row.recurrence_byday) as Array<string> : []
		if (byday.length) {
			rule.push(`BYDAY=${byday.join(',')}`)
		}
		if (row.recurrence_bymonthday) {
			rule.push(`BYMONTHDAY=${row.recurrence_bymonthday}`)
		}
		if (row.recurrence_count) {
			rule.push(`COUNT=${row.recurrence_count}`)
		} else if (row.recurrence_until !== null) {
			rule.push(`UNTIL=${new Date(row.recurrence_until).toISOString().slice(0, 10).replaceAll('-', '')}T235959Z`)
		}
		return rule.join(';')
	}

	/** The RRULE and EXDATEs of the component without a RECURRENCE-ID, decoded as the sync decodes them. */
	private static syncedRule(row: Row) {
		const raw = row.data ? (JSON.parse(row.data) as { raw?: string }).raw : undefined
		if (!raw) {
			return undefined
		}
		try {
			const components = new ICAL.Component(ICAL.parse(raw)).getAllSubcomponents().filter(component => component.name === 'vevent' || component.name === 'vtodo')
			const master = components.find(component => !component.getFirstProperty('recurrence-id')) ?? components[0]
			const rrule = master?.getFirstPropertyValue('rrule')?.toString()
			if (!master || !rrule) {
				return undefined
			}
			const exdates = master.getAllProperties('exdate').flatMap(prop => prop.getValues().map(value => {
				const time = value as ICAL.Time
				const tzId = prop.getParameter('tzid')?.toString()
				if (time.isDate) {
					return Date.UTC(time.year, time.month - 1, time.day)
				}
				// Before floating: ical.js reads a TZID whose VTIMEZONE the resource leaves out as floating.
				if (tzId) {
					try {
						return Temporal.PlainDateTime.from({ year: time.year, month: time.month, day: time.day, hour: time.hour, minute: time.minute, second: time.second })
							.toZonedDateTime(tzId, { disambiguation: 'compatible' }).epochMilliseconds
					} catch {
						// A zone Temporal can't read (Outlook's names) falls through, as in the sync.
					}
				}
				return time.zone === ICAL.Timezone.localTimezone
					? Date.UTC(time.year, time.month - 1, time.day, time.hour, time.minute, time.second)
					: time.toJSDate().getTime()
			}))
			return { rrule, exdates }
		} catch {
			return undefined
		}
	}
}
