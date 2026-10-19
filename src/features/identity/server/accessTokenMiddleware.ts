import { type RequestHandler } from 'express'
import { User } from '../User.js'
import { AccessToken } from '../AccessToken.js'
import { orm } from '../../../infrastructure/database/orm.js'

/**
 * Signs an agent in by the access token it sends (`Authorization: Bearer`), as the user who made it, in every mode; a token
 * that is not one, or no longer, is refused rather than passed on to a sign-in the agent cannot do.
 */
export const accessTokenMiddleware: RequestHandler = async (req, res, next) => {
	const token = req.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1]
	if (!token) {
		return next()
	}
	const em = orm.em.fork()
	const accessToken = await em.findOne(AccessToken, { hash: await AccessToken.hashOf(token) })
	const user = accessToken && await em.findOne(User, { id: accessToken.userId })
	if (!accessToken || !user) {
		return res.status(401).set('WWW-Authenticate', 'Bearer error="invalid_token"').json({ error: 'This access token is not valid. It may have been revoked.' })
	}
	if (accessToken.use()) {
		await em.flush()
	}
	req.user = user
	req.accessToken = accessToken
	return next()
}
