import { Migration } from '@mikro-orm/migrations'

/** What a solo leaves behind, so "show all again" restores what was on show before. */
export class Migration20260817182359_SoloSourceVisibility extends Migration {
	override up() {
		this.addSql('alter table `user` add column `previously_hidden_source_ids` json null;')
	}

	override down() {
		this.addSql('alter table `user` drop column `previously_hidden_source_ids`;')
	}
}
