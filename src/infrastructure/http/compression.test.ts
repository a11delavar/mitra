import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http, { type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { compression, precompressed } from './compression.js'

type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => void

/** Fetch raw undecoded bytes from test server. */
function raw(origin: string, url: string, accept = 'br, gzip') {
	return new Promise<{ status: number, encoding?: string, vary?: string, length?: string, type?: string, bytes: number }>((resolve, reject) => {
		const request = http.request(`${origin}${url}`, { headers: { 'Accept-Encoding': accept } }, response => {
			let bytes = 0
			response.on('data', (chunk: Buffer) => { bytes += chunk.length })
			response.on('end', () => resolve({
				status: response.statusCode!,
				encoding: response.headers['content-encoding'],
				vary: response.headers.vary,
				length: response.headers['content-length'],
				type: response.headers['content-type'],
				bytes,
			}))
		})
		request.setTimeout(4000, () => request.destroy(new Error('TIMED OUT — the response never completed')))
		request.on('error', reject)
		request.end()
	})
}

describe('compression', () => {
	let server: Server
	let origin: string
	const middleware = compression() as unknown as Middleware

	const payload = JSON.stringify(Array.from({ length: 200 }, (_, index) => ({ heading: `Entry ${index}`, start: '2026-08-23T09:00:00.000Z', end: '2026-08-23T10:00:00.000Z' })))
	const streamed = payload.repeat(20)
	let streamedFile: string

	before(async () => {
		streamedFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mitra-compression-')), 'bundle.js')
		fs.writeFileSync(streamedFile, streamed)
		server = http.createServer((req, res) => middleware(req, res, () => {
			const json = (body: string) => {
				res.setHeader('Content-Type', 'application/json; charset=utf-8')
				res.setHeader('Content-Length', Buffer.byteLength(body))
				res.end(body)
			}
			switch (req.url) {
				case '/big':
					return json(payload)
				case '/small':
					return json('{"ok":true}')
				case '/piped':
					res.setHeader('Content-Type', 'text/javascript')
					return void fs.createReadStream(streamedFile).pipe(res)
				default:
					res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' })
					return void res.write('data: first\n\n')
			}
		}))
		await new Promise<void>(resolve => server.listen(0, resolve))
		origin = `http://localhost:${(server.address() as { port: number }).port}`
	})

	after(async () => {
		await new Promise(resolve => server.close(resolve))
		fs.rmSync(path.dirname(streamedFile), { recursive: true, force: true })
	})

	it('encodes a long JSON body, and the client reads back exactly what was sent', async () => {
		const sent = await raw(origin, '/big')
		assert.equal(sent.encoding, 'br')
		assert.equal(sent.length, undefined)

		const plain = await raw(origin, '/big', 'identity')
		assert.equal(plain.encoding, undefined)
		assert.equal(sent.bytes < plain.bytes / 2, true, `expected a real saving, got ${sent.bytes} vs ${plain.bytes}`)

		assert.equal(await (await fetch(`${origin}/big`)).text(), payload)
	})

	it('finishes a piped stream body', async () => {
		const sent = await raw(origin, '/piped')
		assert.equal(sent.encoding, 'br')
		assert.equal(sent.bytes < streamed.length / 5, true, `expected a real saving, got ${sent.bytes} vs ${streamed.length}`)
		assert.equal(await (await fetch(`${origin}/piped`)).text(), streamed)
	})

	it('falls back to gzip for a client that does not take brotli', async () => {
		assert.equal((await raw(origin, '/big', 'gzip, deflate')).encoding, 'gzip')
	})

	it('leaves the event stream uncompressed and unbuffered', async () => {
		const response = await fetch(`${origin}/stream`, { headers: { 'Accept-Encoding': 'br, gzip' } })
		assert.equal(response.headers.get('content-encoding'), null)

		const reader = response.body!.getReader()
		const first = await Promise.race([
			reader.read().then(({ value }) => Buffer.from(value!).toString()),
			new Promise<string>(resolve => setTimeout(() => resolve('TIMED OUT — the stream is buffered'), 2000)),
		])
		assert.equal(first, 'data: first\n\n')
		await reader.cancel()
	})

	it('leaves a body too small to be worth it, and keeps its Content-Length', async () => {
		const sent = await raw(origin, '/small')
		assert.equal(sent.encoding, undefined)
		assert.notEqual(sent.length, undefined)
	})

	it('announces Vary: Accept-Encoding whatever it decided, so a cache cannot mix the two up', async () => {
		assert.equal((await raw(origin, '/big')).vary, 'Accept-Encoding')
		assert.equal((await raw(origin, '/small')).vary, 'Accept-Encoding')
		assert.equal((await raw(origin, '/big', 'identity')).vary, 'Accept-Encoding')
	})
})

describe('precompressed', () => {
	let server: Server
	let origin: string
	let root: string
	const body = 'export const symbol = 1\n'.repeat(500)
	const encoded = zlib.brotliCompressSync(Buffer.from(body))

	before(async () => {
		root = fs.mkdtempSync(path.join(os.tmpdir(), 'mitra-precompressed-'))
		fs.writeFileSync(path.join(root, 'index.js'), body)
		fs.writeFileSync(path.join(root, 'index.js.br'), encoded)
		fs.writeFileSync(path.join(root, 'plain.js'), body)
		// A sibling left behind by an earlier build, older than the source it claims to encode.
		fs.writeFileSync(path.join(root, 'stale.js.br'), encoded)
		fs.writeFileSync(path.join(root, 'stale.js'), body)
		const anHourAgo = new Date(Date.now() - 3600_000)
		fs.utimesSync(path.join(root, 'stale.js.br'), anHourAgo, anHourAgo)

		const middleware = precompressed(root) as unknown as Middleware
		server = http.createServer((req, res) => middleware(req, res, () => {
			const file = path.join(root, new URL(req.url!, 'http://localhost').pathname)
			if (!file.startsWith(root) || !fs.existsSync(file)) {
				res.statusCode = 404
				res.end()
			} else {
				res.end(fs.readFileSync(file))
			}
		}))
		await new Promise<void>(resolve => server.listen(0, resolve))
		origin = `http://localhost:${(server.address() as { port: number }).port}`
	})

	after(async () => {
		await new Promise(resolve => server.close(resolve))
		fs.rmSync(root, { recursive: true, force: true })
	})

	it('serves the build-time sibling, typed off the original extension', async () => {
		const sent = await raw(origin, '/index.js')
		assert.equal(sent.encoding, 'br')
		assert.equal(sent.bytes, encoded.length)
		assert.match(sent.type ?? '', /javascript/)
		assert.equal(await (await fetch(`${origin}/index.js`)).text(), body)
	})

	it('leaves the request alone for a client that cannot decode it', async () => {
		const sent = await raw(origin, '/index.js', 'identity')
		assert.equal(sent.encoding, undefined)
		assert.equal(sent.bytes, body.length)
	})

	it('falls through when there is no sibling', async () => {
		assert.equal((await raw(origin, '/plain.js')).encoding, undefined)
	})

	it('ignores a sibling older than its source', async () => {
		assert.equal((await raw(origin, '/stale.js')).encoding, undefined)
	})

	it('clamps a traversal at the root instead of escaping it', async () => {
		const sent = await raw(origin, '/%2e%2e/%2e%2e/index.js')
		assert.equal(sent.encoding, 'br')
		assert.equal(sent.bytes, encoded.length)
	})

	it('falls through on a malformed escape rather than throwing', async () => {
		assert.equal((await raw(origin, '/%zz.js')).status, 404)
	})
})
