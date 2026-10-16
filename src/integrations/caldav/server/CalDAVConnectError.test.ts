import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { CalDAV } from '../CalDAV.js'
import { CalDAVSyncEngine } from './CalDAVSyncEngine.js'
import { CalDAVRefusal } from './CalDAVConnectError.js'

// Google's error body for a project without the CalDAV API, in its documented shape (google.rpc.Status).
const disabled = 'CalDAV API has not been used in project 1234 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/caldav.googleapis.com/overview?project=1234 then retry.'

describe('CalDAVConnectError', () => {
	let server: Server
	let origin: string
	let answer: { status: number, type: string, body: string }

	before(async () => {
		server = createServer((request, response) => {
			const { status, type, body } = request.url!.startsWith('/caldav/v2/') ? answer : { status: 404, type: 'text/html', body: '<html><title>Not Found</title></html>' }
			response.writeHead(status, { 'content-type': type }).end(body)
		})
		await new Promise<void>(resolve => server.listen(0, resolve))
		origin = `http://localhost:${(server.address() as AddressInfo).port}`
	})

	after(() => new Promise<void>(resolve => server.close(() => resolve())))

	const connect = (engine = new CalDAVSyncEngine(), integration = new CalDAV({ uri: `${origin}/caldav/v2/`, credentials: { username: 'organizer@example.com', password: 'secret' } })) =>
		engine.fetchSources(integration)

	it('names what the server answered at the address given, not tsdav\'s "cannot find principalUrl"', async () => {
		answer = { status: 403, type: 'application/json; charset=UTF-8', body: JSON.stringify({ error: { code: 403, message: disabled, status: 'PERMISSION_DENIED' } }) }
		await assert.rejects(connect(), (error: Error & { status: number }) => {
			assert.equal(error.message, `Could not connect to ${origin}/caldav/v2/: the server answered 403 Forbidden: ${disabled}`)
			assert.equal(error.status, 502)
			return true
		})
	})

	it('connects again after a failure, rather than keeping the failed connection', async () => {
		const integration = new CalDAV({ uri: `${origin}/caldav/v2/`, credentials: { username: 'organizer@example.com', password: 'secret' } })
		const engine = new CalDAVSyncEngine()
		answer = { status: 403, type: 'text/plain', body: 'Forbidden' }
		await assert.rejects(connect(engine, integration), /answered 403 Forbidden$/)
		answer = { status: 401, type: 'text/plain', body: '' }
		await assert.rejects(connect(engine, integration), /answered 401 Unauthorized$/)
	})

	it('reads why from a body in JSON, OAuth, DAV XML, HTML or plain text', () => {
		assert.equal(CalDAVRefusal.reasonIn('{"error":"invalid_grant","error_description":"Token has been expired or revoked."}', 'application/json'), 'Token has been expired or revoked.')
		assert.equal(CalDAVRefusal.reasonIn('<?xml version="1.0"?>\n<d:error xmlns:d="DAV:"><s:message>Access denied</s:message></d:error>', 'application/xml'), 'Access denied')
		assert.equal(CalDAVRefusal.reasonIn('<html><head><title>403 Forbidden</title></head><body><script>…</script></body></html>', 'text/html'), '403 Forbidden')
		assert.equal(CalDAVRefusal.reasonIn('', 'text/plain'), undefined)
		assert.equal(CalDAVRefusal.reasonIn('x'.repeat(400), 'text/plain')!.length, 300)
	})
})
