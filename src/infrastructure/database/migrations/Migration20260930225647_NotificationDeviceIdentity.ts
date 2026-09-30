import { Migration } from '@mikro-orm/migrations'

/**
 * Adds `notification_subscription.name`, `.language`, `.platform`, `.browser` and `.mobile` (see NotificationSubscription).
 * All nullable, so no table rebuild.
 *
 * Introspects first because this REPLAYS on a baselined database, where a dev boot's `orm.schema.update()`
 * already added the columns. `execute`, not `addSql`: queued SQL runs after `up()` returns and could not
 * read its own precondition.
 */
export class Migration20260930225647_NotificationDeviceIdentity extends Migration {
	private static readonly columns = { name: 'text', language: 'text', platform: 'text', browser: 'text', mobile: 'integer' }

	override async up(): Promise<void> {
		for (const [column, type] of Object.entries(Migration20260930225647_NotificationDeviceIdentity.columns)) {
			if (!await this.hasColumn(column)) {
				await this.execute(`alter table \`notification_subscription\` add column \`${column}\` ${type} null;`)
			}
		}
	}

	override async down(): Promise<void> {
		for (const column of Object.keys(Migration20260930225647_NotificationDeviceIdentity.columns)) {
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
