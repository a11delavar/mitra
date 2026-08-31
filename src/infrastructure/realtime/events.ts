import { Router } from 'express'
import { syncEmitter, type SyncScope } from './syncEmitter.js'
import { presence } from './presence.js'

export const eventsRouter = Router()

// Server-Sent Events endpoint streaming data update signals per user.
eventsRouter.get('/', (req, res) => {
	res.writeHead(200, {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive',
	})

	// `updated` stays the word for entry-only changes so a client running a stale bundle keeps refreshing.
	const listener = (userId: string, scope: SyncScope = 'entries') =>
		userId === req.user.id && res.write(`data: ${scope === 'sources' ? 'sources' : 'updated'}\n\n`)
	syncEmitter.on('updated', listener)

	const disconnect = presence.connect(req.user.id)

	req.on('close', () => {
		syncEmitter.off('updated', listener)
		disconnect()
	})
})
