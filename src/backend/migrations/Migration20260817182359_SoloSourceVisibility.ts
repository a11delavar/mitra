import { Migration } from '@mikro-orm/migrations'

/**
 * `User.previouslyHiddenSourceIds` — the record a solo leaves behind so "show all again" can restore
 * exactly what was on show before (see shared/User.ts).
 *
 * Guarded like every migration here: baselining replays post-initial migrations onto databases that
 * predate migrations, and those include DEV builds, whose schema `orm.schema.update()` already made
 * from today's entities — so the column is already there and an unguarded `add column` throws. The
 * failure is not local: it aborts the whole replay and drops the boot into the wholesale-schema-sync
 * fallback, which warns the operator to re-import their integrations.
 */
export class Migration20260817182359_SoloSourceVisibility extends Migration {
	override async up(): Promise<void> {
		const columns = await this.execute('select name from pragma_table_info(\'user\')') as Array<{ name: string }>
		if (columns.some(column => column.name === 'previously_hidden_source_ids')) {
			return
		}

		this.addSql('alter table `user` add column `previously_hidden_source_ids` json null;')
	}

	override down(): void | Promise<void> {
		this.addSql('alter table `user` drop column `previously_hidden_source_ids`;')
	}
}
