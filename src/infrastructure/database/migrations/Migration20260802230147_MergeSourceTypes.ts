import { Migration } from '@mikro-orm/migrations'

/**
 * One collection, one source: merges each CalDAV collection's event/task sibling pair into one row (`entry_types` their
 * union, `enabled` their OR, `hidden` their AND), re-pointing entries and default sources and clearing the sync token.
 * Rebuilds park children in an FK-free holding table: inside the migrator's transaction `pragma foreign_keys = off` does
 * nothing, so dropping `source` would cascade every entry away.
 */
export class Migration20260802230147_MergeSourceTypes extends Migration {
	override async up() {
		// Each group's first row survives. The rebuild nulls default sources (`on delete set null`), so they are read first.
		const rows = await this.execute(
			'select id, integration_id as integrationId, uri, type, enabled, hidden from source order by enabled desc, case type when \'event\' then 0 else 1 end, id',
		) as Array<{ id: string, integrationId: string, uri: string, type: string, enabled: number, hidden: number }>
		const groups = [...Map.groupBy(rows, row => `${row.integrationId} ${row.uri}`).values()]
		const defaultSources = await this.execute('select id, default_source_id as sourceId from user where default_source_id is not null') as Array<{ id: string, sourceId: string }>

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

		const survivorOf = new Map<string, string>()
		for (const group of groups) {
			const [survivor, ...losers] = group
			group.forEach(row => survivorOf.set(row.id, survivor!.id))
			const types = [...new Set(group.map(row => row.type))].sort() // alphabetical = calendar-first
			for (const loser of losers) {
				// One the survivor also holds would collide with the (source_id, uri, recurrence_id) unique index.
				await this.execute(
					'delete from entry where source_id = ? and exists (select 1 from entry other where other.source_id = ? and other.uri is entry.uri and other.recurrence_id is entry.recurrence_id)',
					[loser.id, survivor!.id],
				)
				// Re-point BEFORE deleting the sibling row, since `entry.source_id` cascades on delete.
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

		for (const { id, sourceId } of defaultSources) {
			await this.execute('update user set default_source_id = ? where id = ?', [survivorOf.get(sourceId) ?? sourceId, id])
		}
	}

	override async down() {
		const sources = await this.execute('select id, entry_types as entryTypes from source') as Array<{ id: string, entryTypes: string | null }>
		const defaultSources = await this.execute('select id, default_source_id as sourceId from user where default_source_id is not null') as Array<{ id: string, sourceId: string }>

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

		// The merged row stays the event source, and a new task sibling takes the task entries.
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
