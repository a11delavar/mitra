import { Migration } from '@mikro-orm/migrations'

export class Migration20261025141203_IntegrationName extends Migration {
	override up() {
		this.addSql('alter table `integration` add column `name` text null;')
	}

	override down() {
		this.addSql('alter table `integration` drop column `name`;')
	}
}
