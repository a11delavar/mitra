import { type EntityManager } from '@mikro-orm/core'
import { User } from '../User.js'
import { Integration } from '../../../integrations/Integration.js'
import { Demo } from '../../../integrations/demo/Demo.js'
import { Session } from './Session.js'

/** A demo visitor's throwaway account, holding the sample calendar. */
export class Sandbox {
	/** Past it (`MITRA_DEMO_CAP`), opening a sandbox evicts the oldest; a visitor is never turned away. */
	static readonly cap = Number(process.env.MITRA_DEMO_CAP) || 1000

	/** A sandbox lives this long from the visit that opened it; a visitor still there gets a fresh one. */
	static readonly lifetime = 24 * 60 * 60 * 1000

	private static readonly usernamePrefix = 'demo-'

	/**
	 * The sample calendar is written in `language`, the visitor's browser language on arrival; a switch in Settings rewrites it.
	 * The session is written with the sandbox: one without it would read as expired to a concurrent visitor's eviction.
	 */
	static async open(em: EntityManager, language?: string): Promise<{ user: User, token: string }> {
		await Sandbox.evict(em, Sandbox.cap - 1)
		const user = new User({ username: `${Sandbox.usernamePrefix}${crypto.randomUUID()}` })
		const demo = new Demo({ userId: user.id })
		if (language) {
			demo.credentials = { language }
		}
		const { session, token } = Session.issue(user)
		em.persist([user, demo, session])
		await em.flush()
		await demo.sync(em)
		return { user, token }
	}

	/** Evicts every sandbox past its lifetime, then the oldest down to `count`. @returns how many were evicted. */
	static async evict(em: EntityManager, count: number): Promise<number> {
		const users = await em.find(User, { username: { $like: `${Sandbox.usernamePrefix}%` } })
		const sessions = await em.find(Session, { userId: { $in: users.map(user => user.id) } })
		// A sandbox is as old as its session: they are issued together, and a session only renews past half its 30 days.
		const openedAt = new Map(sessions.map(session => [session.userId, session.expiresAt.getTime() - Session.lifetime]))
		const byAge = users
			.map(user => user.id)
			.sort((a, b) => (openedAt.get(a) ?? 0) - (openedAt.get(b) ?? 0))
		const expired = byAge.filter(id => (openedAt.get(id) ?? 0) <= Date.now() - Sandbox.lifetime).length
		const evicted = byAge.slice(0, Math.max(expired, users.length - count))
		if (!evicted.length) {
			return 0
		}
		// Integrations don't cascade from their user; everything else cascades from one or the other.
		await em.nativeDelete(Integration, { userId: { $in: evicted } })
		await em.nativeDelete(User, { id: { $in: evicted } })
		return evicted.length
	}
}
