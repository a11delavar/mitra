import { Router } from 'express'
import { updates } from './Updates.js'
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
	const unsubscribe = updates.subscribe((userId, scope) =>
		userId === req.user.id && res.write(`data: ${scope === 'sources' ? 'sources' : 'updated'}\n\n`))

	const disconnect = presence.connect(req.user.id)

	req.on('close', () => {
		unsubscribe()
		disconnect()
	})
})
