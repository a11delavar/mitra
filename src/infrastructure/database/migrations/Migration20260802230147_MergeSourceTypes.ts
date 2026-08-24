import { Migration } from '@mikro-orm/migrations'

/**
 * One collection is one source now (see Source.entryTypes): the old model kept an event/task SIBLING
 * PAIR per CalDAV collection — two rows sharing one `uri`, split by the `type` column — and this
 * migration merges each pair into a single row so no instance loses data on update:
 *
 * - the pair's entries are re-pointed at the surviving row (the enabled one, events first on a tie),
 * - what the collection can hold moves into the new `entry_types` list (the union of the pair),
 * - `enabled` is the pair's OR, `hidden` its AND — if either sibling was on show, the collection is,
 * - a user's default source follows the merge (a preference pointing at the losing sibling re-points),
 * - a merged source's `sync_state` is cleared: its two sibling tokens each covered only one component
 *   type's ingestion, so the next sync re-lists the collection from scratch (idempotent upserts).
 *
 * The table rebuilds deliberately do NOT follow the generated drop-and-recreate scaffold: migrations
 * run inside a transaction, where `pragma foreign_keys = off` is a NO-OP — and with foreign keys
 * enforced, SQLite's `drop table` performs an implicit `DELETE FROM` whose `on delete cascade`/`set
 * null` actions fire for real (dropping `source` would have deleted every entry and nulled every
 * user's default source; caught by the fixture test). So each rebuild routes through an FK-free
 * holding table: children are parked and dropped first, the parent is only ever dropped once nothing
 * references it, and the final shapes are recreated last.
 */
export class Migration20260802230147_MergeSourceTypes extends Migration {
	override async up(): Promise<void> {
		// A database born on the new entities (a dev `schema.update()` build) has no `type` column and
		// no sibling pairs — nothing to do.
		const columns = await this.execute('select name from pragma_table_info(\'source\')') as Array<{ name: string }>
		if (!columns.some(column => column.name === 'type')) {
			return
		}

		// 1. Analyse the old shape while `type` still exists: one group per collection — a sibling pair
		// shares its (integration_id, uri) — ordered so each group's FIRST row is the survivor. The
		// users' default-source preferences are captured too: the rebuild below empties `source` once,
		// which fires their `on delete set null`.
		const rows = await this.execute(
			'select id, integration_id as integrationId, uri, type, enabled, hidden from source order by enabled desc, case type when \'event\' then 0 else 1 end, id',
		) as Array<{ id: string, integrationId: string, uri: string, type: string, enabled: number, hidden: number }>
		const groups = [...Map.groupBy(rows, row => `${row.integrationId} ${row.uri}`).values()]
		const defaultSources = await this.execute('select id, default_source_id as sourceId from user where default_source_id is not null') as Array<{ id: string, sourceId: string }>

		// 2. Rebuild: `source` trades `type` for `entry_types` (null for now — filled below), `entry`
		// sheds the old enum's check constraint.
		for (const sql of [
			'create table `entry__holding` (`id` text not null primary key, `source_id` text not null, `uri` text null, `type` text not null, `heading` text not null default \'\', `description` text not null default \'\', `location` text not null default \'\', `color` text null, `start` datetime null, `end` datetime null, `status` text null, `all_day` integer not null default false, `time_zone` text null, `data` json null, `reminders` json null, `participants` json null, `uid` text null, `recurrence_freq` text null, `recurrence_interval` integer null, `recurrence_byday` json null, `recurrence_bymonthday` integer null, `recurrence_count` integer null, `recurrence_until` datetime null, `exdates` json null, `recurrence_master_id` text null, `recurrence_id` datetime null);',
			'insert into `entry__holding` select `id`, `source_id`, `uri`, `type`, `heading`, `description`, `location`, `color`, `start`, `end`, `status`, `all_day`, `time_zone`, `data`, `reminders`, `participants`, `uid`, `recurrence_freq`, `recurrence_interval`, `recurrence_byday`, `recurrence_bymonthday`, `recurrence_count`, `recurrence_until`, `exdates`, `recurrence_master_id`, `recurrence_id` from `entry`;',
			'drop table `entry`;',
			'create table `source__rebuild` (`id` text not null primary key, `integration_id` text not null, `uri` text not null, `entry_types` json null, `name` text not null, `remote_name` text null, `color` text null, `hidden` integer not null default false, `enabled` integer not null default false, `order` integer null, `sync_state` json null, constraint `source_integration_id_foreign` foreign key (`integration_id`) references `integration` (`id`) on delete cascade);',
			'insert into `source__rebuild` select `id`, `integration_id`, `uri`, null as `entry_types`, `name`, `remote_name`, `color`, `hidden`, `enabled`, `order`, `sync_state` from `source`;',
			'drop table `source`;',
			'alter table `source__rebuild` rename to `source`;',
			'create index `source_integration_id_index` on `source` (`integration_id`);',
			'create table `entry` (`id` text not null primary key, `source_id` text not null, `uri` text null, `type` text not null, `heading` text not null default \'\', `description` text not null default \'\', `location` text not null default \'\', `color` text null, `start` datetime null, `end` datetime null, `status` text check (`status` in (\'todo\', \'doing\', \'done\', \'cancelled\')) null, `all_day` integer not null default false, `time_zone` text null, `data` json null, `reminders` json null, `participants` json null, `uid` text null, `recurrence_freq` text null, `recurrence_interval` integer null, `recurrence_byday` json null, `recurrence_bymonthday` integer null, `recurrence_count` integer null, `recurrence_until` datetime null, `exdates` json null, `recurrence_master_id` text null, `recurrence_id` datetime null, constraint `entry_source_id_foreign` foreign key (`source_id`) references `source` (`id`) on delete cascade);',
			'insert into `entry` select `id`, `source_id`, `uri`, `type`, `heading`, `description`, `location`, `color`, `start`, `end`, `status`, `all_day`, `time_zone`, `data`, `reminders`, `participants`, `uid`, `recurrence_freq`, `recurrence_interval`, `recurrence_byday`, `recurrence_bymonthday`, `recurrence_count`, `recurrence_until`, `exdates`, `recurrence_master_id`, `recurrence_id` from `entry__holding`;',
			'drop table `entry__holding`;',
			'create index `entry_source_id_index` on `entry` (`source_id`);',
			'create unique index `entry_source_id_uri_recurrence_id_unique` on `entry` (`source_id`, `uri`, `recurrence_id`);',
		]) {
			await this.execute(sql)
		}

		// 3. Merge each group into its survivor and record what the collection holds.
		const survivorOf = new Map<string, string>()
		for (const group of groups) {
			const [survivor, ...losers] = group
			group.forEach(row => survivorOf.set(row.id, survivor!.id))
			const types = [...new Set(group.map(row => row.type))].sort() // alphabetical = calendar-first
			for (const loser of losers) {
				// A member the survivor also holds would collide with the (source_id, uri, recurrence_id)
				// unique index — the old sync's cross-source duplicate guard made that rare, never impossible.
				await this.execute(
					'delete from entry where source_id = ? and exists (select 1 from entry other where other.source_id = ? and other.uri is entry.uri and other.recurrence_id is entry.recurrence_id)',
					[loser.id, survivor!.id],
				)
				// Re-point BEFORE deleting the sibling row — `entry.source_id` cascades on delete.
				await this.execute('update entry set source_id = ? where source_id = ?', [survivor!.id, loser.id])
				await this.execute('delete from source where id = ?', [loser.id])
			}
			await this.execute('update source set entry_types = ?, enabled = ?, hidden = ? where id = ?', [
				JSON.stringify(types),
				group.some(row => row.enabled) ? 1 : 0,
				group.every(row => row.hidden) ? 1 : 0,
				survivor!.id,
			])
			if (losers.length > 0) {
				await this.execute('update source set sync_state = null where id = ?', [survivor!.id])
			}
		}

		// 4. Restore the default-source preferences the rebuild nulled — onto the survivor when the
		// preference pointed at a merged-away sibling.
		for (const { id, sourceId } of defaultSources) {
			await this.execute('update user set default_source_id = ? where id = ?', [survivorOf.get(sourceId) ?? sourceId, id])
		}
	}

	override async down(): Promise<void> {
		// Read the merged shape before the rebuild replaces it, so the split below knows which
		// collections held both types; capture default sources for the same reason as in `up`.
		const sources = await this.execute('select id, entry_types as entryTypes from source') as Array<{ id: string, entryTypes: string | null }>
		const defaultSources = await this.execute('select id, default_source_id as sourceId from user where default_source_id is not null') as Array<{ id: string, sourceId: string }>

		// The reverse rebuild, through the same FK-free holding table (see the class comment): `entry`
		// gets its check constraint back, `source` its NOT NULL `type` — task-only rows are tasks,
		// everything else becomes the event row and the split below re-creates its task sibling.
		for (const sql of [
			'create table `entry__holding` (`id` text not null primary key, `source_id` text not null, `uri` text null, `type` text not null, `heading` text not null default \'\', `description` text not null default \'\', `location` text not null default \'\', `color` text null, `start` datetime null, `end` datetime null, `status` text null, `all_day` integer not null default false, `time_zone` text null, `data` json null, `reminders` json null, `participants` json null, `uid` text null, `recurrence_freq` text null, `recurrence_interval` integer null, `recurrence_byday` json null, `recurrence_bymonthday` integer null, `recurrence_count` integer null, `recurrence_until` datetime null, `exdates` json null, `recurrence_master_id` text null, `recurrence_id` datetime null);',
			'insert into `entry__holding` select `id`, `source_id`, `uri`, `type`, `heading`, `description`, `location`, `color`, `start`, `end`, `status`, `all_day`, `time_zone`, `data`, `reminders`, `participants`, `uid`, `recurrence_freq`, `recurrence_interval`, `recurrence_byday`, `recurrence_bymonthday`, `recurrence_count`, `recurrence_until`, `exdates`, `recurrence_master_id`, `recurrence_id` from `entry`;',
			'drop table `entry`;',
			'create table `source__rebuild` (`id` text not null primary key, `integration_id` text not null, `uri` text not null, `type` text not null, `name` text not null, `remote_name` text null, `color` text null, `hidden` integer not null default false, `enabled` integer not null default false, `order` integer null, `sync_state` json null, constraint `source_integration_id_foreign` foreign key (`integration_id`) references `integration` (`id`) on delete cascade);',
			'insert into `source__rebuild` select `id`, `integration_id`, `uri`, case when `entry_types` = \'["task"]\' then \'task\' else \'event\' end as `type`, `name`, `remote_name`, `color`, `hidden`, `enabled`, `order`, null as `sync_state` from `source`;',
			'drop table `source`;',
			'alter table `source__rebuild` rename to `source`;',
			'create index `source_integration_id_index` on `source` (`integration_id`);',
			'create table `entry` (`id` text not null primary key, `source_id` text not null, `uri` text null, `type` text check (`type` in (\'event\', \'task\')) not null, `heading` text not null default \'\', `description` text not null default \'\', `location` text not null default \'\', `color` text null, `start` datetime null, `end` datetime null, `status` text check (`status` in (\'todo\', \'doing\', \'done\', \'cancelled\')) null, `all_day` integer not null default false, `time_zone` text null, `data` json null, `reminders` json null, `participants` json null, `uid` text null, `recurrence_freq` text null, `recurrence_interval` integer null, `recurrence_byday` json null, `recurrence_bymonthday` integer null, `recurrence_count` integer null, `recurrence_until` datetime null, `exdates` json null, `recurrence_master_id` text null, `recurrence_id` datetime null, constraint `entry_source_id_foreign` foreign key (`source_id`) references `source` (`id`) on delete cascade);',
			'insert into `entry` select `id`, `source_id`, `uri`, `type`, `heading`, `description`, `location`, `color`, `start`, `end`, `status`, `all_day`, `time_zone`, `data`, `reminders`, `participants`, `uid`, `recurrence_freq`, `recurrence_interval`, `recurrence_byday`, `recurrence_bymonthday`, `recurrence_count`, `recurrence_until`, `exdates`, `recurrence_master_id`, `recurrence_id` from `entry__holding`;',
			'drop table `entry__holding`;',
			'create index `entry_source_id_index` on `entry` (`source_id`);',
			'create unique index `entry_source_id_uri_recurrence_id_unique` on `entry` (`source_id`, `uri`, `recurrence_id`);',
		]) {
			await this.execute(sql)
		}

		// Re-split collections that held both types: the merged row stays the event source, a fresh
		// task sibling takes the task entries. The original sibling's id is gone for good — ids are
		// opaque, so a new one serves. Both start token-less and re-list on the next sync.
		for (const source of sources) {
			const types = JSON.parse(source.entryTypes ?? '[]') as Array<string>
			if (!types.includes('event') || !types.includes('task')) {
				continue
			}
			const siblingId = crypto.randomUUID()
			await this.execute(
				'insert into source (id, integration_id, uri, type, name, remote_name, color, hidden, enabled, `order`, sync_state) select ?, integration_id, uri, \'task\', name, remote_name, color, hidden, enabled, `order`, null from source where id = ?',
				[siblingId, source.id],
			)
			await this.execute('update entry set source_id = ? where source_id = ? and type = \'task\'', [siblingId, source.id])
		}

		for (const { id, sourceId } of defaultSources) {
			await this.execute('update user set default_source_id = ? where id = ?', [sourceId, id])
		}
	}
}
