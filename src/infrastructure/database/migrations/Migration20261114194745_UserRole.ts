import { Migration } from '@mikro-orm/migrations'

/**
 * The first account administers: the first that signs in, else the local one, never a demo's sandbox. `rowid` keeps the
 * order the accounts were made in, which no column records.
 */
export class Migration20261114194745_UserRole extends Migration {
	override up() {
		this.addSql('alter table `user` add column `role` text not null default \'member\';')
		this.addSql(`update \`user\` set \`role\` = 'administrator' where \`id\` = (
			select \`id\` from \`user\` where \`username\` not like 'demo-%' order by \`oidc_issuer\` is null, rowid limit 1
		);`)
	}

	override down() {
		this.addSql('alter table `user` drop column `role`;')
	}
}
