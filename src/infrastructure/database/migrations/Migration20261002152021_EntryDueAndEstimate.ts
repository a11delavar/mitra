import { Migration } from '@mikro-orm/migrations'

/**
 * Adds `entry.due` and `entry.estimate` (see Entry). Both nullable, so no table rebuild. A task synced with a DUE and
 * no DTSTART used to keep it in `end`; it moves to `due`, which is what it always was.
 *
 * Introspects first because this REPLAYS on a baselined database, where a dev boot's `orm.schema.update()` already
 * added the columns. `execute`, not `addSql`: queued SQL runs after `up()` returns and could not read its own precondition.
 */
export class Migration20261002152021_EntryDueAndEstimate extends Migration {
	private static readonly columns = { due: 'datetime', estimate: 'integer' }

	override async up(): Promise<void> {
		for (const [column, type] of Object.entries(Migration20261002152021_EntryDueAndEstimate.columns)) {
			if (!await this.hasColumn(column)) {
				await this.execute(`alter table \`entry\` add column \`${column}\` ${type} null;`)
			}
		}
		await this.execute('update `entry` set `due` = `end`, `end` = null where `type` = \'task\' and `start` is null and `end` is not null and `due` is null;')
	}

	override async down(): Promise<void> {
		if (await this.hasColumn('due')) {
			await this.execute('update `entry` set `end` = `due` where `start` is null and `due` is not null;')
		}
		for (const column of Object.keys(Migration20261002152021_EntryDueAndEstimate.columns)) {
			if (await this.hasColumn(column)) {
				await this.execute(`alter table \`entry\` drop column \`${column}\`;`)
			}
		}
	}

	private async hasColumn(name: string): Promise<boolean> {
		const rows = await this.execute('select name from pragma_table_info(\'entry\');') as Array<{ name: string }>
		return rows.some(row => row.name === name)
	}
}
