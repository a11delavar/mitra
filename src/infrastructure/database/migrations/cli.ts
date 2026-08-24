import { readFile, writeFile } from 'node:fs/promises'
import { MikroORM } from '@mikro-orm/sqlite'
import { TSMigrationGenerator } from '@mikro-orm/migrations'
import { createLogger } from '../../logging/Logger.js'
import { ormConfig } from '../ormConfig.js'
import { migrate } from './migrate.js'

const logger = createLogger('Database')

// The migrations CLI behind the root `db:migration:*` scripts (built and run by scripts/db.ts,
// which bundles it the same way as the backend). Commands:
//   create <Name> — diff the entities against the committed schema snapshot and generate a
//                   migration named `Migration<timestamp>_<Name>` (e.g. `npm run db:migration:create -- Participants`)
//   up            — apply pending migrations to the local database, exactly as a production boot would
//   down          — revert the latest applied migration

/** Emits generated migrations in this repository's style (tabs, single quotes, no semicolons) so
 * they need no touch-up before committing. */
class MitraMigrationGenerator extends TSMigrationGenerator {
	override generateMigrationFile(className: string, diff: { up: Array<string>, down: Array<string> }) {
		// Empty diff entries are group separators — kept as blank lines, but stripped at the edges.
		const statements = (direction: Array<string>) => direction.slice(
			direction.findIndex(sql => sql !== ''),
			direction.findLastIndex(sql => sql !== '') + 1,
		)
		let content = 'import { Migration } from \'@mikro-orm/migrations\'\n\n'
		content += `export class ${className} extends Migration {\n`
		content += '\toverride up(): void | Promise<void> {\n'
		statements(diff.up).forEach(sql => content += this.createStatement(sql, 2))
		content += '\t}\n'
		if (diff.down.length > 0) {
			content += '\n\toverride down(): void | Promise<void> {\n'
			statements(diff.down).forEach(sql => content += this.createStatement(sql, 2))
			content += '\t}\n'
		}
		content += '}\n'
		return content
	}

	override createStatement(sql: string, padLeft: number) {
		return sql ? `${'\t'.repeat(padLeft)}this.addSql('${sql.replace(/[\\']/g, '\\$&')}')\n` : '\n'
	}
}

const migrationsDirectory = `${process.cwd()}/src/infrastructure/database/migrations`

/** Generation is pure — entities + committed snapshot in, SQL out. An in-memory database keeps the
 * result independent of whatever state the local dev database happens to be in. */
async function createMigration(name: string) {
	const config = ormConfig(':memory:')
	const orm = await MikroORM.init({
		...config,
		migrations: {
			...config.migrations,
			path: migrationsDirectory,
			emit: 'ts',
			snapshot: true,
			snapshotName: '.schema-snapshot',
			generator: MitraMigrationGenerator,
		},
	})
	try {
		const result = await orm.migrator.create(undefined, false, false, name)
		if (!result.fileName) {
			logger.info('No schema changes detected — entities match the snapshot.')
			return
		}
		const className = result.fileName.replace(/\.ts$/, '')
		await registerMigration(className)
		logger.info(`Generated ${result.fileName} and registered it in migrations/index.ts — review it before committing.`)
	} finally {
		await orm.close()
	}
}

/** Appends the freshly generated migration to migrations/index.ts, which the bundled backend imports
 * in place of on-disk discovery. */
async function registerMigration(className: string) {
	const indexPath = `${migrationsDirectory}/index.ts`
	const index = await readFile(indexPath, 'utf8')
	const withImport = index.replace(/\n(\/\*\*)/, `\nimport { ${className} } from './${className}.js'\n$1`)
	const withEntry = withImport.replace(/\n\]\n$/, `\n\t${className},\n]\n`)
	if (withImport === index || withEntry === withImport) {
		throw new Error(`Could not register ${className} in ${indexPath} — add it manually.`)
	}
	await writeFile(indexPath, withEntry)
}

async function run(direction: 'up' | 'down') {
	const orm = await MikroORM.init(ormConfig(`${process.cwd()}/data/database.sqlite`))
	try {
		if (direction === 'up') {
			await migrate(orm)
		} else {
			const reverted = await orm.migrator.down()
			logger.info(reverted.length > 0 ? `Reverted ${reverted.map(migration => migration.name).join(', ')}` : 'No applied migration to revert.')
		}
	} finally {
		await orm.close()
	}
}

const command = process.argv[2]
switch (command) {
	case 'create': {
		// The name becomes part of the class name (`Migration<timestamp>_<Name>`), so it must be a
		// bare PascalCase identifier — and requiring one keeps the migration history self-describing.
		const name = process.argv[3]
		if (!name || !/^[A-Z][A-Za-z0-9]*$/.test(name)) {
			console.error(`Migrations need a PascalCase name, e.g.: npm run db:migration:create -- ${name ? 'Participants' : 'Initial'}`)
			process.exitCode = 1
			break
		}
		await createMigration(name)
		break
	}
	case 'up':
	case 'down':
		await run(command)
		break
	default:
		console.error(`Unknown command '${command ?? ''}' — expected create, up or down.`)
		process.exitCode = 1
}
