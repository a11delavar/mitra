import { Migration } from '@mikro-orm/migrations'

export class Migration20261114184035_RoutineUntracked extends Migration {
	override up() {
		this.addSql('alter table `routine` add column `untracked` integer null;')
	}

	override down() {
		this.addSql('alter table `routine` drop column `untracked`;')
	}
}
