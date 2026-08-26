import { Migration } from '@mikro-orm/migrations'

/**
 * Adds `source.read_only` (see Source.readOnly). Nullable integer, no checks, so no table rebuild.
 *
 * Introspects first because this REPLAYS on a baselined database: an instance first booted in dev got
 * its schema from `orm.schema.update()` against the current entities, so the column is already there
 * and a bare `add column` would fail the boot. `execute`, not `addSql` — queued SQL runs after `up()`
 * returns and could not read its own precondition.
 *
 * The generator also offered an `integration` rebuild (its discriminator gained `ics`) and a second
 * `entry.percent_complete`; both dropped by hand. The discriminator is an unconstrained text column,
 * and that rebuild would have cascaded every `source` away. `percent_complete` is already added by
 * Migration20260822140000 — it reappeared only because the committed snapshot was never regenerated.
 */
export class Migration20260826182337_AddSourceReadOnly extends Migration {
	override async up(): Promise<void> {
		if (!await this.hasColumn()) {
			await this.execute('alter table `source` add column `read_only` integer null;')
		}
	}

	override async down(): Promise<void> {
		if (await this.hasColumn()) {
			await this.execute('alter table `source` drop column `read_only`;')
		}
	}

	private async hasColumn(): Promise<boolean> {
		const rows = await this.execute('select name from pragma_table_info(\'source\');') as Array<{ name: string }>
		return rows.some(row => row.name === 'read_only')
	}
}
