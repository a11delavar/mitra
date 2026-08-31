import { Migration } from '@mikro-orm/migrations'

/**
 * Adds `source.imported_at` column and backfills enabled sources with current timestamp.
 */
export class Migration20260831093000_SourceImportedAt extends Migration {
	override async up(): Promise<void> {
		if (!await this.hasColumn()) {
			await this.execute('alter table `source` add column `imported_at` datetime null;')
		}
		await this.execute('update `source` set `imported_at` = strftime(\'%s\', \'now\') * 1000 where `enabled` = 1 and `imported_at` is null;')
	}

	override async down(): Promise<void> {
		if (await this.hasColumn()) {
			await this.execute('alter table `source` drop column `imported_at`;')
		}
	}

	private async hasColumn(): Promise<boolean> {
		const rows = await this.execute('select name from pragma_table_info(\'source\');') as Array<{ name: string }>
		return rows.some(row => row.name === 'imported_at')
	}
}
