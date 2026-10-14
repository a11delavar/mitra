import { Migration } from '@mikro-orm/migrations'

export class Migration20260822140000_EntryPercentComplete extends Migration {
	override up() {
		this.addSql('alter table `entry` add column `percent_complete` integer null;')
	}

	override down() {
		this.addSql('alter table `entry` drop column `percent_complete`;')
	}
}
