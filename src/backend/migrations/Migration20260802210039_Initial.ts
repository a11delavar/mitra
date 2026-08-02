import { Migration } from '@mikro-orm/migrations'

export class Migration20260802210039_Initial extends Migration {
	override up(): void | Promise<void> {
		this.addSql('create table `state` (`key` text not null primary key, `value` json not null);')

		this.addSql('create table `user` (`id` text not null primary key, `username` text not null, `oidc_issuer` text null, `oidc_subject` text null, `oidc_email` text null, `oidc_name` text null, `oidc_picture` text null, `default_source_id` text null, `time_zones` json null, `last_seen_version` text null, constraint `user_default_source_id_foreign` foreign key (`default_source_id`) references `source` (`id`) on delete set null);')
		this.addSql('create unique index `user_username_unique` on `user` (`username`);')
		this.addSql('create index `user_default_source_id_index` on `user` (`default_source_id`);')
		this.addSql('create unique index `user_oidc_issuer_oidc_subject_unique` on `user` (`oidc_issuer`, `oidc_subject`);')

		this.addSql('create table `session` (`id` text not null primary key, `user_id` text not null, `expires_at` datetime not null, `id_token` text null, constraint `session_user_id_foreign` foreign key (`user_id`) references `user` (`id`) on delete cascade);')
		this.addSql('create index `session_user_id_index` on `session` (`user_id`);')

		this.addSql('create table `notification_subscription` (`id` text not null primary key, `user_id` text not null, `endpoint` text not null, `keys` json not null, constraint `notification_subscription_user_id_foreign` foreign key (`user_id`) references `user` (`id`) on delete cascade);')
		this.addSql('create index `notification_subscription_user_id_index` on `notification_subscription` (`user_id`);')
		this.addSql('create unique index `notification_subscription_endpoint_unique` on `notification_subscription` (`endpoint`);')

		this.addSql('create table `integration` (`id` text not null primary key, `user_id` text not null, `uri` text null, `type` text not null, `credentials` json not null, `order` integer null, `addresses` json null, constraint `integration_user_id_foreign` foreign key (`user_id`) references `user` (`id`));')
		this.addSql('create index `integration_user_id_index` on `integration` (`user_id`);')
		this.addSql('create index `integration_type_index` on `integration` (`type`);')
		this.addSql('create unique index `integration_user_id_uri_unique` on `integration` (`user_id`, `uri`);')

		this.addSql('create table `source` (`id` text not null primary key, `integration_id` text not null, `uri` text not null, `type` text check (`type` in (\'event\', \'task\')) not null, `name` text not null, `remote_name` text null, `color` text null, `hidden` integer not null default false, `enabled` integer not null default false, `order` integer null, `sync_state` json null, constraint `source_integration_id_foreign` foreign key (`integration_id`) references `integration` (`id`) on delete cascade);')
		this.addSql('create index `source_integration_id_index` on `source` (`integration_id`);')

		this.addSql('create table `entry` (`id` text not null primary key, `source_id` text not null, `uri` text null, `type` text check (`type` in (\'event\', \'task\')) not null, `heading` text not null default \'\', `description` text not null default \'\', `location` text not null default \'\', `color` text null, `start` datetime null, `end` datetime null, `status` text check (`status` in (\'todo\', \'doing\', \'done\', \'cancelled\')) null, `all_day` integer not null default false, `time_zone` text null, `data` json null, `reminders` json null, `participants` json null, `uid` text null, `recurrence_freq` text null, `recurrence_interval` integer null, `recurrence_byday` json null, `recurrence_bymonthday` integer null, `recurrence_count` integer null, `recurrence_until` datetime null, `exdates` json null, `recurrence_master_id` text null, `recurrence_id` datetime null, constraint `entry_source_id_foreign` foreign key (`source_id`) references `source` (`id`) on delete cascade);')
		this.addSql('create index `entry_source_id_index` on `entry` (`source_id`);')
		this.addSql('create unique index `entry_source_id_uri_recurrence_id_unique` on `entry` (`source_id`, `uri`, `recurrence_id`);')
	}

	override down(): void | Promise<void> {
		this.addSql('drop table if exists `state`;')
		this.addSql('drop table if exists `user`;')
		this.addSql('drop table if exists `session`;')
		this.addSql('drop table if exists `notification_subscription`;')
		this.addSql('drop table if exists `integration`;')
		this.addSql('drop table if exists `source`;')
		this.addSql('drop table if exists `entry`;')
	}
}
