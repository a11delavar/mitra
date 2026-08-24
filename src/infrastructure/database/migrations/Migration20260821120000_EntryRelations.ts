import { Migration } from '@mikro-orm/migrations'

/**
 * The relationship mirror (`EntryRelation`) — the queryable store behind `Entry.relations`, whose
 * indexed `target_uid` answers "who points at this entry?" (see features/relations/EntryRelation.ts).
 *
 * Guarded like every migration here: baselining replays everything after the initial migration onto
 * databases that predate migrations entirely, and those include DEV builds, whose schema was made by
 * `orm.schema.update()` off the current entities — so the table is already there. An unguarded
 * `create table` fails on exactly those, and the failure isn't local: it aborts the whole replay and
 * drops the boot into the wholesale-schema-sync fallback, warning the operator to re-import their
 * integrations. The table can only pre-exist because the same entity created it, so its shape matches
 * by construction and skipping is safe.
 *
 * ORDERED LAST ON PURPOSE, after the `entry` table rebuild in
 * Migration20260820213906_EntryTransparencyAndVisibility. `entry_relation.entry_id` is an FK with
 * `on delete cascade`, and MikroORM's `__temp_alter` rebuild scaffold does `drop table entry` — the
 * `pragma foreign_keys = off` it emits is a NO-OP inside the migrator's transaction (measured: the
 * pragma still reads 1), so the drop fires the cascade and DELETES EVERY RELATION ROW. Creating this
 * table after that rebuild means it simply isn't there to be cascaded.
 *
 * The hazard outlives this ordering: any FUTURE migration that rebuilds `entry` will wipe relations
 * unless it parks the rows in an FK-free holding table first and restores them after the rename.
 */
export class Migration20260821120000_EntryRelations extends Migration {
	override async up(): Promise<void> {
		const [existing] = await this.execute('select name from sqlite_master where type = \'table\' and name = \'entry_relation\'') as Array<{ name: string }>
		if (existing) {
			return
		}

		this.addSql('create table `entry_relation` (`id` text not null primary key, `entry_id` text not null, `target_uid` text not null, `type` text not null, `gap` text null, constraint `entry_relation_entry_id_foreign` foreign key (`entry_id`) references `entry` (`id`) on delete cascade);')
		this.addSql('create index `entry_relation_entry_id_index` on `entry_relation` (`entry_id`);')
		this.addSql('create index `entry_relation_target_uid_index` on `entry_relation` (`target_uid`);')
	}

	override down(): void | Promise<void> {
		this.addSql('drop table if exists `entry_relation`;')
	}
}
