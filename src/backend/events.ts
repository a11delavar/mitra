import { Router } from 'express'
import { syncEmitter } from './syncEmitter.js'
import { presence } from './presence.js'

export const eventsRouter = Router()

// Server-sent events: push a tick to the client whenever ITS user's data changes.
eventsRouter.get('/', (req, res) => {
	res.writeHead(200, {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive',
	})

	const listener = (userId: string) => userId === req.user.id && res.write('data: updated\n\n')
	syncEmitter.on('updated', listener)

	// The stream doubles as the user's presence: while at least one is open, their integrations
	// poll at the fast pace, and the first to open triggers an immediate sync (see Synchronizer) —
	// announced AFTER the listener above, so that sync's tick can already reach this very stream.
	const disconnect = presence.connect(req.user.id)

	req.on('close', () => {
		syncEmitter.off('updated', listener)
		disconnect()
	})
})
