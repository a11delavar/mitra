import { Router } from 'express'
import { orm } from './orm.js'
import { syncEmitter } from './syncEmitter.js'
import { Source } from '../shared/index.js'

export const sourcesRouter = Router()

sourcesRouter.put('/:id/visibility', async (req, res) => {
	const em = orm.em.fork()
	const source = await em.findOneOrFail(Source, { id: req.params.id })

	source.hidden = req.body.hidden
	await em.flush()

	syncEmitter.emit('updated')
	return res.json(source)
})

sourcesRouter.put('/:id/color', async (req, res) => {
	const em = orm.em.fork()
	const source = await em.findOneOrFail(Source, { id: req.params.id })

	source.color = req.body.color
	await em.flush()

	syncEmitter.emit('updated')
	return res.json(source)
})
