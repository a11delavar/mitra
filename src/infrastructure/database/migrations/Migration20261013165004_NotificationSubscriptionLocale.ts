import { Migration } from '@mikro-orm/migrations'

export class Migration20261013165004_NotificationSubscriptionLocale extends Migration {
	override up() {
		this.addSql('alter table `notification_subscription` rename column `language` to `locale`;')
	}

	override down() {
		this.addSql('alter table `notification_subscription` rename column `locale` to `language`;')
	}
}
