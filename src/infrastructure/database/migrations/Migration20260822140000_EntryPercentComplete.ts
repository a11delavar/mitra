import { Migration } from '@mikro-orm/migrations'

/** Adds task percent_complete column (RFC 5545 §3.8.1.8). Nullable integer without checks requires no table rebuild. */
export class Migration20260822140000_EntryPercentComplete extends Migration {
	override up(): void | Promise<void> {
		this.addSql('alter table `entry` add column `percent_complete` integer null;')
	}

	override down(): void | Promise<void> {
		this.addSql('alter table `entry` drop column `percent_complete`;')
	}
}
