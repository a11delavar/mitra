import { Migration } from '@mikro-orm/migrations'

export class Migration20260817182359_SoloSourceVisibility extends Migration {
	override up(): void | Promise<void> {
		this.addSql('alter table `user` add column `previously_hidden_source_ids` json null;')
	}

	override down(): void | Promise<void> {
		this.addSql('alter table `user` drop column `previously_hidden_source_ids`;')
	}
}
