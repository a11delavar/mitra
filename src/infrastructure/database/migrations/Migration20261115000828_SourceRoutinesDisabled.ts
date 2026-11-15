import { Migration } from '@mikro-orm/migrations'

export class Migration20261115000828_SourceRoutinesDisabled extends Migration {
	override up() {
		this.addSql('alter table `source` add column `routines_disabled` integer not null default false;')
	}

	override down() {
		this.addSql('alter table `source` drop column `routines_disabled`;')
	}
}
