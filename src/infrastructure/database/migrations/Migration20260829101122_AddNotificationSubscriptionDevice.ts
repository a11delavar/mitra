import { Migration } from '@mikro-orm/migrations'

/**
 * Adds `notification_subscription.time_zone` and `.last_seen_at` (see NotificationSubscription) — what a
 * registered browser reports about itself, so a floating entry's reminder can be resolved in the reader's
 * own zone and a silent device can be told apart from an idle one. Both nullable, no checks, so no table
 * rebuild; rows written before this simply have neither.
 *
 * Introspects first because this REPLAYS on a baselined database: an instance first booted in dev got its
 * schema from `orm.schema.update()` against the current entities, so the columns are already there and a
 * bare `add column` would fail the boot. `execute`, not `addSql` — queued SQL runs after `up()` returns
 * and could not read its own precondition.
 */
export class Migration20260829101122_AddNotificationSubscriptionDevice extends Migration {
	private static readonly columns = ['time_zone', 'last_seen_at']

	override async up(): Promise<void> {
		const types = { time_zone: 'text', last_seen_at: 'datetime' }
		for (const column of Migration20260829101122_AddNotificationSubscriptionDevice.columns) {
			if (!await this.hasColumn(column)) {
				await this.execute(`alter table \`notification_subscription\` add column \`${column}\` ${types[column as keyof typeof types]} null;`)
			}
		}
	}

	override async down(): Promise<void> {
		for (const column of Migration20260829101122_AddNotificationSubscriptionDevice.columns) {
			if (await this.hasColumn(column)) {
				await this.execute(`alter table \`notification_subscription\` drop column \`${column}\`;`)
			}
		}
	}

	private async hasColumn(name: string): Promise<boolean> {
		const rows = await this.execute('select name from pragma_table_info(\'notification_subscription\');') as Array<{ name: string }>
		return rows.some(row => row.name === name)
	}
}
