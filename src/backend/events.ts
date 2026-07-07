import { Router } from 'express'
import { syncEmitter } from './syncEmitter.js'

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

	req.on('close', () => syncEmitter.off('updated', listener))
})
