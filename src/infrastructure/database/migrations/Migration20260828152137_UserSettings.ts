import { Migration } from '@mikro-orm/migrations'

export class Migration20260828152137_UserSettings extends Migration {
	override up() {
		this.addSql('alter table `user` add column `settings` json null;')
	}

	override down() {
		this.addSql('alter table `user` drop column `settings`;')
	}
}
