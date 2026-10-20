import { Router } from 'express'
import { orm } from '#infrastructure/database/orm.js'
import { Notion } from '../Notion.js'

export const notionRouter = Router()

/** A picture in Notion's own store has a link signed for an hour, so the browser is sent to a fresh one each time it asks. */
notionRouter.get('/blocks/:blockId', async (req, res) => {
	const em = orm.em.fork()
	const accounts = (await req.user.integrations(em)).filter((integration): integration is Notion => integration instanceof Notion)
	for (const account of accounts) {
		try {
			const url = await account.fileUrlOf(req.params.blockId)
			res.setHeader('Cache-Control', 'private, max-age=1800')
			return res.redirect(url)
		} catch {
			continue
		}
	}
	return res.status(404).json({ error: 'No such file' })
})
