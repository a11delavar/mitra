import { Migration } from '@mikro-orm/migrations'

/**
 * Adds `entry.rank`. No backfill: the order endpoint assigns keys the first time one is needed.
 */
export class Migration20261003010248_EntryRank extends Migration {
	override async up(): Promise<void> {
		if (!await this.hasColumn()) {
			await this.execute('alter table `entry` add column `rank` text null;')
		}
	}

	override async down(): Promise<void> {
		if (await this.hasColumn()) {
			await this.execute('alter table `entry` drop column `rank`;')
		}
	}

	private async hasColumn(): Promise<boolean> {
		const rows = await this.execute('select name from pragma_table_info(\'entry\');') as Array<{ name: string }>
		return rows.some(row => row.name === 'rank')
	}
}
