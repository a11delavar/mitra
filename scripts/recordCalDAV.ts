import { execFileSync, spawnSync } from 'node:child_process'

/*
	Records what real CalDAV servers answer `CalDAV.servers.test.ts` (src/integrations/caldav/recordings/<server>.json): each
	server starts in Docker with the accounts the test signs in with, the test runs against it once, and it stops. Names the
	servers to record, or records them all:

		npm run record:caldav -- nextcloud

	Every server also holds another user's calendar "Team", which the account may read: the address naming that user lists it.
	Each runs its image's latest version, pulled first, which its recording names.
*/

interface CalDAVServer {
	readonly name: string
	readonly image: string
	/** The version of the server the image holds, as its image declares it. */
	versionIn(image: string): string
	/** Starts the server in `container` with its accounts, and answers the address the test records from, the account's credentials in it. */
	start(container: string, image: string): Promise<string>
}

const docker = (args: Array<string>, input?: string) => {
	try {
		return execFileSync('docker', args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'] })
	} catch (error) {
		throw new Error(`docker ${args.join(' ')}: ${(error as { stderr?: string }).stderr || (error as Error).message}`, { cause: error })
	}
}

/** A label of an image, or one of its environment variables. */
const labelOf = (image: string, label: string) => docker(['image', 'inspect', image, '--format', `{{index .Config.Labels "${label}"}}`]).trim()
const variableOf = (image: string, variable: string) => docker(['image', 'inspect', image, '--format', '{{range .Config.Env}}{{println .}}{{end}}'])
	.split('\n').find(line => line.startsWith(`${variable}=`))?.slice(variable.length + 1).trim() ?? ''

const until = async (ready: () => Promise<boolean> | boolean, what: string) => {
	for (let attempt = 0; attempt < 180; attempt++) {
		if (await Promise.resolve().then(ready).catch(() => false)) {
			return
		}
		await new Promise(resolve => setTimeout(resolve, 1000))
	}
	throw new Error(`${what} never became ready`)
}

const basic = (user: string, password: string) => `Basic ${btoa(`${user}:${password}`)}`

/** Another user's calendar with one event, which the account reads by that user's address. */
const holdTeam = async (calendars: string, user: string, password: string) => {
	const authorization = basic(user, password)
	const made = await fetch(`${calendars}team/`, {
		method: 'MKCALENDAR',
		headers: { authorization, 'content-type': 'application/xml' },
		body: '<?xml version="1.0" encoding="utf-8"?><C:mkcalendar xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav"><D:set><D:prop><D:displayname>Team</D:displayname></D:prop></D:set></C:mkcalendar>',
	})
	const put = await fetch(`${calendars}team/offsite.ics`, {
		method: 'PUT',
		headers: { authorization, 'content-type': 'text/calendar' },
		body: ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//another app//EN', 'BEGIN:VEVENT', 'UID:offsite', 'DTSTAMP:20261001T000000Z',
			'DTSTART:20261027T090000Z', 'DTEND:20261027T170000Z', 'SUMMARY:Offsite', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n'),
	})
	if (made.status !== 201 || !put.ok) {
		throw new Error(`${user}'s calendar was refused: ${made.status}, ${put.status}`)
	}
}

const radicale: CalDAVServer = {
	name: 'radicale',
	image: 'tomsquest/docker-radicale',
	versionIn: image => labelOf(image, 'org.label-schema.version'),
	async start(container, image) {
		docker(['run', '-d', '--rm', '--name', container, '-p', '5232:5232', image])
		// Radicale takes any user, but lets each read only its own calendars unless its rights say otherwise.
		docker(['exec', '-i', container, 'sh', '-c', 'cat >> /config/config'], '\n[rights]\ntype = authenticated\n')
		docker(['restart', container])
		await until(async () => (await fetch('http://localhost:5232/')).status < 500, 'Radicale')
		await holdTeam('http://localhost:5232/teammate/', 'teammate', 'secret')
		return 'http://localhost:5232'
	},
}

/** Configures ckulka/baikal without its install wizard: SQLite, Basic auth, two users, the second delegating reading to the first. */
const baikalSetup = `set -e
cd /var/www/baikal
cat > config/baikal.yaml <<'YAML'
system:
    configured_version: '0.10.1'
    timezone: 'Europe/Berlin'
    card_enabled: true
    cal_enabled: true
    dav_auth_type: 'Basic'
    admin_passwordhash: 'unused'
    failed_access_message: 'user %u authentication failure for Baikal'
    auth_realm: 'BaikalDAV'
    base_uri: ''
    invite_from: 'noreply@localhost'
database:
    sqlite_file: '/var/www/baikal/Specific/db/db.sqlite'
    backend: 'sqlite'
    mysql_host: ''
    mysql_dbname: ''
    mysql_username: ''
    mysql_password: ''
    encryption_key: 'mitra-test'
    pgsql_host: ''
    pgsql_dbname: ''
    pgsql_username: ''
    pgsql_password: ''
YAML
rm -f Specific/db/db.sqlite
sqlite3 Specific/db/db.sqlite < Core/Resources/Db/SQLite/db.sql
for user in mitra-test teammate; do
	digest=$(php -r "echo md5('$user:BaikalDAV:secret');")
	sqlite3 Specific/db/db.sqlite "insert into users (username, digesta1) values ('$user', '$digest');
		insert into principals (uri, email, displayname) values ('principals/$user', '$user@example.com', '$user');
		insert into principals (uri) values ('principals/$user/calendar-proxy-read');
		insert into principals (uri) values ('principals/$user/calendar-proxy-write');"
done
sqlite3 Specific/db/db.sqlite "insert into groupmembers (principal_id, member_id) select delegate.id, reader.id from principals delegate, principals reader
	where delegate.uri = 'principals/teammate/calendar-proxy-read' and reader.uri = 'principals/mitra-test';"
chown -R nginx:nginx Specific config
`

const baikal: CalDAVServer = {
	name: 'baikal',
	image: 'ckulka/baikal:nginx',
	versionIn: image => labelOf(image, 'org.opencontainers.image.version'),
	async start(container, image) {
		docker(['run', '-d', '--rm', '--name', container, '-p', '8081:80', image])
		docker(['exec', '-i', container, 'sh', '-s'], baikalSetup)
		await until(async () => (await fetch('http://localhost:8081/dav.php/')).status < 500, 'Baïkal')
		await holdTeam('http://localhost:8081/dav.php/calendars/teammate/', 'teammate', 'secret')
		return 'http://mitra-test:secret@localhost:8081'
	},
}

const nextcloud: CalDAVServer = {
	name: 'nextcloud',
	image: 'nextcloud:apache',
	versionIn: image => variableOf(image, 'NEXTCLOUD_VERSION'),
	async start(container, image) {
		// Its password policy refuses a short one.
		const password = 'Mitra-test-Secret-42'
		docker(['run', '-d', '--rm', '--name', container, '-p', '8080:80', '-e', 'SQLITE_DATABASE=nextcloud', '-e', 'NEXTCLOUD_ADMIN_USER=admin',
			'-e', 'NEXTCLOUD_ADMIN_PASSWORD=mitra-test-admin', '-e', 'NEXTCLOUD_TRUSTED_DOMAINS=localhost', image])
		const occ = (...args: Array<string>) => docker(['exec', '-u', 'www-data', container, 'php', 'occ', ...args])
		// Apache serves only once the container has installed Nextcloud, which `occ status` reports as done before it is.
		await until(async () => (await (await fetch('http://localhost:8080/status.php')).json() as { installed: boolean }).installed, 'Nextcloud')
		// A deleted calendar keeps its name in the trash, which refuses the next recording's calendar of that name.
		occ('config:app:set', 'dav', 'calendarRetentionObligation', '--value=0')
		docker(['exec', '-u', 'www-data', '-e', `OC_PASS=${password}`, container, 'php', 'occ', 'user:add', '--password-from-env', 'mitra-test'])
		occ('app:install', 'deck')
		// A Deck board is a calendar that refuses sync-collection (415); its dated card is what Mitra reads from it.
		const deck = async (path: string, body: object) => {
			const response = await fetch(`http://localhost:8080/index.php/apps/deck/api/v1.0/${path}`, {
				method: 'POST',
				headers: { 'authorization': basic('mitra-test', password), 'OCS-APIRequest': 'true', 'content-type': 'application/json' },
				body: JSON.stringify(body),
			})
			return await response.json() as { id: number }
		}
		const board = await deck('boards', { title: 'Launch', color: '0082c9' })
		const stack = await deck(`boards/${board.id}/stacks`, { title: 'To do', order: 1 })
		await deck(`boards/${board.id}/stacks/${stack.id}/cards`, { title: 'Write the announcement', type: 'plain', order: 1, duedate: '2026-10-23T12:00:00+00:00' })
		return `http://mitra-test:${password}@localhost:8080`
	},
}

const servers = [radicale, baikal, nextcloud]
const named = process.argv.slice(2)
const unknown = named.filter(name => !servers.some(server => server.name === name))
if (unknown.length) {
	throw new Error(`No CalDAV server named ${unknown.join(', ')}; there are ${servers.map(server => server.name).join(', ')}`)
}

execFileSync('node', ['./scripts/test.ts'], { stdio: 'inherit' })
const failed = new Array<string>()
for (const server of servers.filter(server => !named.length || named.includes(server.name))) {
	const container = `mitra-test-${server.name}`
	try {
		docker(['pull', '--quiet', server.image])
		const version = server.versionIn(server.image)
		const address = await server.start(container, server.image)
		const run = spawnSync('node', ['--test', `--test-name-pattern=^${server.name}( |$)`, 'out_test/integrations/caldav/CalDAV.servers.test.js'], {
			stdio: 'inherit',
			env: { ...process.env, MITRA_TEST_CALDAV: `${server.name}${version ? `@${version}` : ''}=${address}` },
		})
		if (run.status) {
			failed.push(server.name)
		}
	} finally {
		try {
			docker(['stop', container])
		} catch {
			// It never started.
		}
	}
}
if (failed.length) {
	throw new Error(`The test failed against ${failed.join(', ')}, so its recording may hold a failed run`)
}
