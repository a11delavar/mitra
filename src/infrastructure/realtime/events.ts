import { Router } from 'express'
import { syncEmitter } from './syncEmitter.js'
import { presence } from './presence.js'

export const eventsRouter = Router()

// Server-Sent Events endpoint streaming data update signals per user.
eventsRouter.get('/', (req, res) => {
	res.writeHead(200, {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive',
	})

	const listener = (userId: string) => userId === req.user.id && res.write('data: updated\n\n')
	syncEmitter.on('updated', listener)

	const disconnect = presence.connect(req.user.id)

	req.on('close', () => {
		syncEmitter.off('updated', listener)
		disconnect()
	})
})
