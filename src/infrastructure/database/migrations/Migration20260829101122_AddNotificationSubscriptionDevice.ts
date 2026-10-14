import { Migration } from '@mikro-orm/migrations'

export class Migration20260829101122_AddNotificationSubscriptionDevice extends Migration {
	override up() {
		this.addSql('alter table `notification_subscription` add column `time_zone` text null;')
		this.addSql('alter table `notification_subscription` add column `last_seen_at` datetime null;')
	}

	override down() {
		this.addSql('alter table `notification_subscription` drop column `time_zone`;')
		this.addSql('alter table `notification_subscription` drop column `last_seen_at`;')
	}
}
