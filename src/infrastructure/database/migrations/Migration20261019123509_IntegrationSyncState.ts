import { Migration } from '@mikro-orm/migrations'

export class Migration20261019123509_IntegrationSyncState extends Migration {
	override up() {
		this.addSql('alter table `integration` add column `sync_state` json null;')
	}

	override down() {
		this.addSql('alter table `integration` drop column `sync_state`;')
	}
}
