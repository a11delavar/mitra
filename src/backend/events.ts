import { Router } from 'express'
import { syncEmitter } from './syncEmitter.js'

export const eventsRouter = Router()

// Server-sent events: push a tick to the client whenever data changes.
eventsRouter.get('/', (req, res) => {
	res.writeHead(200, {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive',
	})

	const listener = () => res.write(`data: updated\n\n`)
	syncEmitter.on('updated', listener)

	req.on('close', () => syncEmitter.off('updated', listener))
})
