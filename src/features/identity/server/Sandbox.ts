import { type EntityManager } from '@mikro-orm/core'
import { User } from '../User.js'
import { Integration } from '../../../integrations/Integration.js'
import { Demo } from '../../../integrations/demo/Demo.js'
import { Session } from './Session.js'

/** A demo visitor's throwaway account, holding the sample calendar. */
export class Sandbox {
	/** Past it, opening a sandbox evicts the least recently seen one; a visitor is never turned away. */
	static readonly cap = 300

	private static readonly usernamePrefix = 'demo-'

	/** The sample calendar is written in `language`, the visitor's browser language on arrival; a switch in Settings rewrites it. */
	static async open(em: EntityManager, language?: string): Promise<User> {
		await Sandbox.evictDownTo(em, Sandbox.cap - 1)
		const user = new User({ username: `${Sandbox.usernamePrefix}${crypto.randomUUID()}` })
		const demo = new Demo({ userId: user.id })
		if (language) {
			demo.credentials = { language }
		}
		em.persist([user, demo])
		await em.flush()
		await demo.sync(em)
		return user
	}

	/** @returns how many were evicted. */
	static async evictDownTo(em: EntityManager, count: number): Promise<number> {
		const users = await em.find(User, { username: { $like: `${Sandbox.usernamePrefix}%` } })
		if (users.length <= count) {
			return 0
		}
		const sessions = await em.find(Session, { userId: { $in: users.map(user => user.id) } })
		const seenAt = new Map(sessions.map(session => [session.userId, session.expiresAt.getTime()]))
		const evicted = users
			.map(user => user.id)
			.sort((a, b) => (seenAt.get(a) ?? 0) - (seenAt.get(b) ?? 0))
			.slice(0, users.length - count)
		// Integrations don't cascade from their user; everything else cascades from one or the other.
		await em.nativeDelete(Integration, { userId: { $in: evicted } })
		await em.nativeDelete(User, { id: { $in: evicted } })
		return evicted.length
	}
}
