import { Migration } from '@mikro-orm/migrations'

/** A task synced with a DUE and no DTSTART kept it in `end`; it moves to `due`. */
export class Migration20261002152021_EntryDueAndEstimate extends Migration {
	override up() {
		this.addSql('alter table `entry` add column `due` datetime null;')
		this.addSql('alter table `entry` add column `estimate` integer null;')
		this.addSql('update `entry` set `due` = `end`, `end` = null where `type` = \'task\' and `start` is null and `end` is not null;')
	}

	override down() {
		this.addSql('update `entry` set `end` = `due` where `start` is null and `due` is not null;')
		this.addSql('alter table `entry` drop column `due`;')
		this.addSql('alter table `entry` drop column `estimate`;')
	}
}
