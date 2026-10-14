import { Migration } from '@mikro-orm/migrations'

/** Enabled sources count as imported already. */
export class Migration20260831093000_SourceImportedAt extends Migration {
	override up() {
		this.addSql('alter table `source` add column `imported_at` datetime null;')
		this.addSql('update `source` set `imported_at` = strftime(\'%s\', \'now\') * 1000 where `enabled` = 1;')
	}

	override down() {
		this.addSql('alter table `source` drop column `imported_at`;')
	}
}
