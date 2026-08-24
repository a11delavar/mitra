import { Migration } from '@mikro-orm/migrations'

/**
 * Adds the entry's free/busy contribution (RFC 5545 TRANSP) and access classification (RFC 5545 CLASS).
 * SQLite can't attach a CHECK to a column added with `alter table`, so both enums arrive via the
 * table rebuild MikroORM generates. The rebuild also drops the stale CHECK the initial migration put
 * on `type`: that column is a custom mapper now, and the ORM's own schema has carried no constraint
 * there for a while — this is prod catching up with what a fresh database already looks like.
 */
export class Migration20260820213906_EntryTransparencyAndVisibility extends Migration {
	override up(): void | Promise<void> {
		this.addSql('pragma foreign_keys = off;')
		this.addSql('create table `entry__temp_alter` (`id` text not null primary key, `source_id` text not null, `uri` text null, `type` text not null, `heading` text not null default \'\', `description` text not null default \'\', `location` text not null default \'\', `color` text null, `start` datetime null, `end` datetime null, `status` text check (`status` in (\'todo\', \'doing\', \'done\', \'cancelled\')) null, `transparency` text check (`transparency` in (\'busy\', \'free\')) null, `visibility` text check (`visibility` in (\'public\', \'private\', \'confidential\')) null, `all_day` integer not null default false, `time_zone` text null, `data` json null, `reminders` json null, `participants` json null, `uid` text null, `recurrence_freq` text null, `recurrence_interval` integer null, `recurrence_byday` json null, `recurrence_bymonthday` integer null, `recurrence_count` integer null, `recurrence_until` datetime null, `exdates` json null, `recurrence_master_id` text null, `recurrence_id` datetime null, constraint `entry_source_id_foreign` foreign key (`source_id`) references `source` (`id`) on delete cascade);')
		this.addSql('insert into `entry__temp_alter` select `id`, `source_id`, `uri`, `type`, `heading`, `description`, `location`, `color`, `start`, `end`, `status`, null as `transparency`, null as `visibility`, `all_day`, `time_zone`, `data`, `reminders`, `participants`, `uid`, `recurrence_freq`, `recurrence_interval`, `recurrence_byday`, `recurrence_bymonthday`, `recurrence_count`, `recurrence_until`, `exdates`, `recurrence_master_id`, `recurrence_id` from `entry`;')
		this.addSql('drop table `entry`;')
		this.addSql('alter table `entry__temp_alter` rename to `entry`;')
		this.addSql('create index `entry_source_id_index` on `entry` (`source_id`);')
		this.addSql('create unique index `entry_source_id_uri_recurrence_id_unique` on `entry` (`source_id`, `uri`, `recurrence_id`);')
		this.addSql('pragma foreign_keys = on;')
	}

	override down(): void | Promise<void> {
		this.addSql('pragma foreign_keys = off;')
		this.addSql('create table `entry__temp_alter` (`all_day` integer not null default false, `color` text null, `data` json null, `description` text not null default \'\', `end` datetime null, `exdates` json null, `heading` text not null default \'\', `id` text not null primary key, `location` text not null default \'\', `participants` json null, `recurrence_byday` json null, `recurrence_bymonthday` integer null, `recurrence_count` integer null, `recurrence_freq` text null, `recurrence_id` datetime null, `recurrence_interval` integer null, `recurrence_master_id` text null, `recurrence_until` datetime null, `reminders` json null, `source_id` text not null, `start` datetime null, `status` text check (`status` in (\'todo\', \'doing\', \'done\', \'cancelled\')) null, `time_zone` text null, `type` text not null, `uid` text null, `uri` text null, constraint `entry_source_id_foreign` foreign key (`source_id`) references `source` (`id`) on delete cascade);')
		this.addSql('insert into `entry__temp_alter` select `all_day`, `color`, `data`, `description`, `end`, `exdates`, `heading`, `id`, `location`, `participants`, `recurrence_byday`, `recurrence_bymonthday`, `recurrence_count`, `recurrence_freq`, `recurrence_id`, `recurrence_interval`, `recurrence_master_id`, `recurrence_until`, `reminders`, `source_id`, `start`, `status`, `time_zone`, `type`, `uid`, `uri` from `entry`;')
		this.addSql('drop table `entry`;')
		this.addSql('alter table `entry__temp_alter` rename to `entry`;')
		this.addSql('create index `entry_source_id_index` on `entry` (`source_id`);')
		this.addSql('create unique index `entry_source_id_uri_recurrence_id_unique` on `entry` (`source_id`, `uri`, `recurrence_id`);')
		this.addSql('pragma foreign_keys = on;')
	}
}
