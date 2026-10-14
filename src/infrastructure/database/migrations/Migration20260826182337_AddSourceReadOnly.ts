import { Migration } from '@mikro-orm/migrations'

/**
 * The generator's `integration` rebuild (its discriminator gained `ics`) was dropped by hand: the column is unconstrained
 * text, and the rebuild's drop would cascade every source away.
 */
export class Migration20260826182337_AddSourceReadOnly extends Migration {
	override up() {
		this.addSql('alter table `source` add column `read_only` integer null;')
	}

	override down() {
		this.addSql('alter table `source` drop column `read_only`;')
	}
}
