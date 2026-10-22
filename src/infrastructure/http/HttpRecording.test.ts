import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpRecording } from './HttpRecording.testing.js'

const token = 'AbCd1234EfGh5678'

/** A server that mints a token on the first request and expects it back on the second. */
const minting = () => {
	const server = createServer((request, response) => {
		response.writeHead(200, { 'content-type': 'application/json' })
		response.end(request.url === '/start' ? JSON.stringify({ token }) : JSON.stringify({ read: request.url === `/next?token=${token}` }))
	})
	return new Promise<{ origin: string, close: () => void }>(resolve => server.listen(0, () => resolve({
		origin: `http://localhost:${(server.address() as AddressInfo).port}`,
		close: () => server.close(),
	})))
}

describe('HttpRecording', () => {
	it('keeps a made-up value of the same shape for what the server minted, which replay hands back alike', async () => {
		const folder = mkdtempSync(join(tmpdir(), 'mitra-recording-'))
		const file = join(folder, 'minted.json')
		const format = { tokens: [/(?<="token":")[0-9A-Za-z]{16}(?=")/g, /(?<=[?&]token=)[0-9A-Za-z]{16}/g] }
		try {
			const real = await minting()
			const recording = new HttpRecording(file, () => ({}), format)
			const proxy = await recording.record(real.origin)
			const minted = await fetch(`${proxy.origin}/start`).then(response => response.json() as Promise<{ token: string }>)
			await fetch(`${proxy.origin}/next?token=${minted.token}`)
			await proxy.close()
			real.close()

			const kept = (JSON.parse(readFileSync(file, 'utf8')) as { minted: { token: Array<string> } }).minted.token
			assert.equal(readFileSync(file, 'utf8').includes(token), false, 'the real value is nowhere in the file')
			assert.equal(kept.length, 1)
			assert.match(kept[0]!, /^[A-Z][a-z][A-Z][a-z]\d{4}[A-Z][a-z][A-Z][a-z]\d{4}$/)

			const replay = await new HttpRecording(file, () => ({}), format).replay()
			const handed = await fetch(`${replay.origin}/start`).then(response => response.json() as Promise<{ token: string }>)
			assert.equal(handed.token, kept[0])
			const next = await fetch(`${replay.origin}/next?token=${handed.token}`).then(response => response.json() as Promise<{ read: boolean }>)
			assert.equal(next.read, true)
			assert.deepEqual(replay.unrecorded, [])
			await replay.close()
		} finally {
			rmSync(folder, { recursive: true, force: true })
		}
	})
})
