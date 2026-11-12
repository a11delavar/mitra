import { Migration } from '@mikro-orm/migrations'
import { Backfill } from '../Backfill.js'

/** Routines become a record of their own. The entries already there are placed in them once the server starts (`RecognizeStoredEntries`). */
export class Migration20261112090000_Routines extends Migration {
	override async up() {
		await this.execute('create table `routine` (`id` text not null primary key, `source_id` text not null, `name` text null, `dissolved` integer null, constraint `routine_source_id_foreign` foreign key (`source_id`) references `source` (`id`) on delete cascade);')
		await this.execute('create index `routine_source_id_index` on `routine` (`source_id`);')
		await this.execute('alter table `entry` add column `routine_id` text null constraint `entry_routine_id_foreign` references `routine` (`id`) on delete set null;')
		await this.execute('alter table `entry` add column `routine_declined` integer null;')
		await this.execute('create index `entry_routine_id_index` on `entry` (`routine_id`);')
		await this.execute(Backfill.asking('recognize-stored-entries'))
	}

	override async down() {
		await this.execute('drop index `entry_routine_id_index`;')
		await this.execute('alter table `entry` drop column `routine_declined`;')
		await this.execute('alter table `entry` drop column `routine_id`;')
		await this.execute('drop table if exists `routine`;')
	}
}
