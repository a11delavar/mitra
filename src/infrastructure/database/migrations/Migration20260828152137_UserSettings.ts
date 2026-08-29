import { Migration } from '@mikro-orm/migrations'

/** Adds nullable json `settings` column to `user` table if not present. */
export class Migration20260828152137_UserSettings extends Migration {
	override async up(): Promise<void> {
		const columns = await this.execute('select name from pragma_table_info(\'user\')') as Array<{ name: string }>
		if (columns.some(column => column.name === 'settings')) {
			return
		}

		this.addSql('alter table `user` add column `settings` json null;')
	}

	override down(): void | Promise<void> {
		this.addSql('alter table `user` drop column `settings`;')
	}
}
