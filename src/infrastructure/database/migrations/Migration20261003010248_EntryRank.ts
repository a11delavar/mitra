import { Migration } from '@mikro-orm/migrations'

/** No backfill: the order endpoint assigns keys the first time one is needed. */
export class Migration20261003010248_EntryRank extends Migration {
	override up() {
		this.addSql('alter table `entry` add column `rank` text null;')
	}

	override down() {
		this.addSql('alter table `entry` drop column `rank`;')
	}
}
