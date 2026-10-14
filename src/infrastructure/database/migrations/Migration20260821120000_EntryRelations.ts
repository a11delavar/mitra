import { Migration } from '@mikro-orm/migrations'

/**
 * After the `entry` rebuild on purpose: its `drop table entry` would cascade every relation row away, as `pragma
 * foreign_keys = off` does nothing inside the migrator's transaction. A later rebuild of `entry` must park them first.
 */
export class Migration20260821120000_EntryRelations extends Migration {
	override up() {
		this.addSql('create table `entry_relation` (`id` text not null primary key, `entry_id` text not null, `target_uid` text not null, `type` text not null, `gap` text null, constraint `entry_relation_entry_id_foreign` foreign key (`entry_id`) references `entry` (`id`) on delete cascade);')
		this.addSql('create index `entry_relation_entry_id_index` on `entry_relation` (`entry_id`);')
		this.addSql('create index `entry_relation_target_uid_index` on `entry_relation` (`target_uid`);')
	}

	override down() {
		this.addSql('drop table if exists `entry_relation`;')
	}
}
