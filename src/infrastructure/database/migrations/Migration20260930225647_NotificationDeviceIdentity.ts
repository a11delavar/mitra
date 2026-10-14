import { Migration } from '@mikro-orm/migrations'

export class Migration20260930225647_NotificationDeviceIdentity extends Migration {
	private static readonly columns = { name: 'text', language: 'text', platform: 'text', browser: 'text', mobile: 'integer' }

	override up() {
		for (const [column, type] of Object.entries(Migration20260930225647_NotificationDeviceIdentity.columns)) {
			this.addSql(`alter table \`notification_subscription\` add column \`${column}\` ${type} null;`)
		}
	}

	override down() {
		for (const column of Object.keys(Migration20260930225647_NotificationDeviceIdentity.columns)) {
			this.addSql(`alter table \`notification_subscription\` drop column \`${column}\`;`)
		}
	}
}
