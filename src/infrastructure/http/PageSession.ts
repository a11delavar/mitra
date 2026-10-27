import { GetUser, GetMeta } from '#operations'
import type { User } from '#features/identity'
import { Instance } from '#features/about/Instance.js'
import type { UserSettings } from '#features/settings/UserSettings.js'

/**
 * What this page learned of the server it talks to: who is signed in, kept from what the last change answered, and what the
 * instance says of itself, read again once it is a few hours old.
 */
export class PageSession {
	private static readonly instanceMaxAge = 6 * 60 * 60 * 1000

	/** The signed-in user, once read. */
	user?: User

	/** What the server said of itself; until it answers, the release this page runs and nothing more. */
	instance = new Instance({ version: mitra.version, commit: mitra.commit })

	private answeredAt = 0

	/** The signed-in user's settings, none until the user is read. */
	get settings(): UserSettings {
		return this.user?.settings ?? {}
	}

	async fetchUser() {
		return this.user = await GetUser.call()
	}

	/** Keeps the user a change answers with as the signed-in one, which `user` reads until the next. */
	async keepUser(answer: Promise<User>) {
		return this.user = await answer
	}

	/** Asks the server again; one that does not answer leaves what it said before. */
	async fetchInstance() {
		this.answeredAt = Date.now()
		return this.instance = await GetMeta.call().catch(() => this.instance)
	}

	async refreshInstanceIfStale() {
		if (Date.now() - this.answeredAt > PageSession.instanceMaxAge) {
			await this.fetchInstance()
		}
		return this.instance
	}
}

export const session = new PageSession()
