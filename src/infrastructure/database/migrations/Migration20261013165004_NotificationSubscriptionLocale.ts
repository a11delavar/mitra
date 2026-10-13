import { Migration } from '@mikro-orm/migrations'

/**
 * Renames `notification_subscription.language` to `locale`: it holds a whole BCP 47 tag (`en-GB`) since regions.
 *
 * Introspects first because this REPLAYS on a baselined database, where a dev boot's `orm.schema.update()` already
 * added an empty `locale` beside `language`; then the tags move over and `language` goes. `execute`, not `addSql`:
 * queued SQL runs after `up()` returns and could not read its own precondition.
 */
export class Migration20261013165004_NotificationSubscriptionLocale extends Migration {
	override async up(): Promise<void> {
		await this.move('language', 'locale')
	}

	override async down(): Promise<void> {
		await this.move('locale', 'language')
	}

	private async move(from: string, to: string) {
		const columns = await this.columns()
		if (!columns.has(from)) {
			return
		}
		if (!columns.has(to)) {
			await this.execute(`alter table \`notification_subscription\` rename column \`${from}\` to \`${to}\`;`)
			return
		}
		await this.execute(`update \`notification_subscription\` set \`${to}\` = \`${from}\` where \`${to}\` is null;`)
		await this.execute(`alter table \`notification_subscription\` drop column \`${from}\`;`)
	}

	private async columns(): Promise<Set<string>> {
		const rows = await this.execute('select name from pragma_table_info(\'notification_subscription\');') as Array<{ name: string }>
		return new Set(rows.map(row => row.name))
	}
}
