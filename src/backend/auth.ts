import type { RequestHandler } from 'express'
import { User } from '../shared/index.js'
import { orm } from './orm.js'

// Resolve (or seed) the single default user once at startup.
let defaultUser = await orm.em.findOne(User, { username: User.default.username })
if (!defaultUser) {
	defaultUser = User.default
	orm.em.persist(defaultUser)
	await orm.em.flush()
}

/**
 * Zero-auth single-user mode: attaches the default user to every request. This is where a
 * Bearer/OIDC check would go in a multi-user setup.
 */
export const authMiddleware: RequestHandler = (req, _res, next) => {
	(req as any).user = defaultUser
	next()
}
