import { type EntityManager } from '@mikro-orm/core'
import { Integration } from '#integrations'
import { Demo } from '#integrations/demo/Demo.js'
import { environment } from '#infrastructure/server/Environment.js'
import { User } from '../User.js'
import { Session } from './Session.js'

/** A demo visitor's throwaway account, holding the sample calendar. */
export class Sandbox {
	/** Past it (`MITRA_DEMO_CAP`), opening a sandbox evicts the oldest; a visitor is never turned away. */
	static get cap() {
		return environment.demoCap
	}

	/** A sandbox lives this long from the visit that opened it; a visitor still there gets a fresh one. */
	static readonly lifetime = 24 * 60 * 60 * 1000

	private static readonly usernamePrefix = 'demo-'

	/**
	 * The sample calendar is written in `language`, the visitor's browser language on arrival; a switch in Settings rewrites it.
	 * The session is written with the sandbox: one without it would read as expired to a concurrent visitor's eviction.
	 */
	static async open(em: EntityManager, language?: string) {
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

	/** Every sandbox, each as old as its session: they are issued together, and a session only renews past half its 30 days. */
	static async all(em: EntityManager) {
		const users = await em.find(User, { username: { $like: `${Sandbox.usernamePrefix}%` } })
		const sessions = await em.find(Session, { userId: { $in: users.map(user => user.id) } })
		const openedAt = new Map(sessions.map(session => [session.userId, session.expiresAt.getTime() - Session.lifetime]))
		return users.map(user => new Sandbox(user, openedAt.get(user.id) ?? 0))
	}

	/** Evicts every sandbox past its lifetime, then the oldest down to `count`. @returns how many were evicted. */
	static async evict(em: EntityManager, count: number) {
		const byAge = (await Sandbox.all(em)).sort((a, b) => a.openedAt - b.openedAt)
		const expired = byAge.filter(sandbox => sandbox.expired).length
		const evicted = byAge.slice(0, Math.max(expired, byAge.length - count)).map(sandbox => sandbox.user.id)
		if (!evicted.length) {
			return 0
		}
		// Integrations don't cascade from their user; everything else cascades from one or the other.
		await em.nativeDelete(Integration, { userId: { $in: evicted } })
		await em.nativeDelete(User, { id: { $in: evicted } })
		return evicted.length
	}

	private constructor(readonly user: User, readonly openedAt: number) { }

	get expired() {
		return this.openedAt <= Date.now() - Sandbox.lifetime
	}
}
