import { Migration } from '@mikro-orm/migrations'

/** The files an entry carries, Mitra's own by hash and other apps' by URL, each a fact of its entry. */
export class Migration20261016022519_Files extends Migration {
	override up() {
		this.addSql('create table `entry_file` (`id` text not null primary key, `user_id` text null, `source_url` text null, `sha256` text null, `name` text null, `mime_type` text null, `size` integer null, `created_at` datetime not null, `entry_id` text not null, `type` text check (`type` in (\'attachment\')) not null, `rank` integer not null default 0, constraint `entry_file_entry_id_foreign` foreign key (`entry_id`) references `entry` (`id`) on delete cascade);')
		this.addSql('create index `entry_file_user_id_index` on `entry_file` (`user_id`);')
		this.addSql('create index `entry_file_entry_id_index` on `entry_file` (`entry_id`);')
		this.addSql('create unique index `entry_file_entry_id_type_source_url_unique` on `entry_file` (`entry_id`, `type`, `source_url`);')
		this.addSql('create unique index `entry_file_entry_id_type_sha256_unique` on `entry_file` (`entry_id`, `type`, `sha256`);')
	}

	override down() {
		this.addSql('drop table if exists `entry_file`;')
	}
}
