import { Migration } from '@mikro-orm/migrations'

/**
 * STATUS is one column for tasks and events, so its CHECK widens to an event's words, which SQLite only does through a
 * rebuild. The entry's children are parked in FK-free tables first: `drop table entry` would cascade their rows away, as
 * `pragma foreign_keys = off` does nothing inside the migrator's transaction.
 */
export class Migration20261101120000_EntryStatusOfEvents extends Migration {
	override up() {
		this.rebuild('\'todo\', \'doing\', \'done\', \'confirmed\', \'tentative\', \'cancelled\'', '`status`')
	}

	override down() {
		this.rebuild('\'todo\', \'doing\', \'done\', \'cancelled\'', 'case when `status` in (\'tentative\', \'confirmed\') then null else `status` end')
	}

	/** Rebuilds `entry` with `statuses` as its STATUS words, each row's read by `status`. */
	private rebuild(statuses: string, status: string) {
		const columns = ['id', 'source_id', 'uri', 'uid', 'type', 'heading', 'description', 'location', 'color', 'start', 'end', 'due', 'estimate', 'status', 'percent_complete', 'rank',
			'transparency', 'visibility', 'all_day', 'time_zone', 'data', 'reminders', 'participants', 'recurrence', 'exdates', 'recurring_entry_id', 'recurrence_id']
		this.addSql('create table `entry_relation__hold` as select * from `entry_relation`;')
		this.addSql('create table `entry_file__hold` as select * from `entry_file`;')
		this.addSql('drop table `entry_relation`;')
		this.addSql('drop table `entry_file`;')
		this.addSql(`create table \`entry__temp_alter\` (\`id\` text not null primary key, \`source_id\` text not null, \`uri\` text null, \`uid\` text null, \`type\` text not null, \`heading\` text not null default '', \`description\` text not null default '', \`location\` text not null default '', \`color\` text null, \`start\` datetime null, \`end\` datetime null, \`due\` datetime null, \`estimate\` integer null, \`status\` text check (\`status\` in (${statuses})) null, \`percent_complete\` integer null, \`rank\` text null, \`transparency\` text check (\`transparency\` in ('busy', 'free')) null, \`visibility\` text check (\`visibility\` in ('public', 'private', 'confidential')) null, \`all_day\` integer not null default false, \`time_zone\` text null, \`data\` json null, \`reminders\` json null, \`participants\` json null, \`recurrence\` text null, \`exdates\` json null, \`recurring_entry_id\` text null, \`recurrence_id\` datetime null, constraint \`entry_source_id_foreign\` foreign key (\`source_id\`) references \`source\` (\`id\`) on delete cascade);`)
		this.addSql(`insert into \`entry__temp_alter\` (${columns.map(column => `\`${column}\``).join(', ')}) select ${columns.map(column => column === 'status' ? status : `\`${column}\``).join(', ')} from \`entry\`;`)
		this.addSql('drop table `entry`;')
		this.addSql('alter table `entry__temp_alter` rename to `entry`;')
		this.addSql('create index `entry_source_id_index` on `entry` (`source_id`);')
		this.addSql('create unique index `entry_source_id_uri_recurrence_id_unique` on `entry` (`source_id`, `uri`, `recurrence_id`);')
		this.addSql('create table `entry_relation` (`id` text not null primary key, `entry_id` text not null, `target_uid` text not null, `type` text not null, `gap` text null, constraint `entry_relation_entry_id_foreign` foreign key (`entry_id`) references `entry` (`id`) on delete cascade);')
		this.addSql('create index `entry_relation_entry_id_index` on `entry_relation` (`entry_id`);')
		this.addSql('create index `entry_relation_target_uid_index` on `entry_relation` (`target_uid`);')
		this.addSql('insert into `entry_relation` (`id`, `entry_id`, `target_uid`, `type`, `gap`) select `id`, `entry_id`, `target_uid`, `type`, `gap` from `entry_relation__hold`;')
		this.addSql('drop table `entry_relation__hold`;')
		this.addSql('create table `entry_file` (`id` text not null primary key, `user_id` text null, `source_url` text null, `sha256` text null, `name` text null, `mime_type` text null, `size` integer null, `created_at` datetime not null, `entry_id` text not null, `type` text check (`type` in (\'attachment\')) not null, `rank` integer not null default 0, constraint `entry_file_entry_id_foreign` foreign key (`entry_id`) references `entry` (`id`) on delete cascade);')
		this.addSql('create index `entry_file_user_id_index` on `entry_file` (`user_id`);')
		this.addSql('create index `entry_file_entry_id_index` on `entry_file` (`entry_id`);')
		this.addSql('create unique index `entry_file_entry_id_type_source_url_unique` on `entry_file` (`entry_id`, `type`, `source_url`);')
		this.addSql('create unique index `entry_file_entry_id_type_sha256_unique` on `entry_file` (`entry_id`, `type`, `sha256`);')
		this.addSql('insert into `entry_file` (`id`, `user_id`, `source_url`, `sha256`, `name`, `mime_type`, `size`, `created_at`, `entry_id`, `type`, `rank`) select `id`, `user_id`, `source_url`, `sha256`, `name`, `mime_type`, `size`, `created_at`, `entry_id`, `type`, `rank` from `entry_file__hold`;')
		this.addSql('drop table `entry_file__hold`;')
	}
}
