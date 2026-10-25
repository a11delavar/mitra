import { Api, HttpError, apiError, apiAuthenticator, type ApiAuthenticator } from '@a11d/api'
import { GetUser, GetMeta } from '#operations'
import type { User } from '#features/identity'
import { EntryFile } from '#features/entries'
import { type InstanceMeta } from '#features/about/InstanceMeta.js'
import { type UserSettings } from '#features/settings/UserSettings.js'

@apiError()
export class ApiError extends HttpError {
	get status() {
		return this.response.status
	}

	override async throw(): Promise<never> {
		if (this.status === 401) {
			location.assign(`/auth/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`)
		}
		const body = await this.response.json().catch(() => undefined) as { error?: string } | undefined
		this.message = body?.error || this.response.statusText || `Request failed (${this.response.status})`
		throw this
	}
}

/** Include session credentials with API requests for auth proxy compatibility. */
@apiAuthenticator()
export class CookieAuthenticator implements ApiAuthenticator {
	authenticate() { }
	unauthenticate() { }
	isAuthenticated() { return true }
	processRequest(request: RequestInit) {
		request.credentials = 'include'
		return request
	}
}

let currentUser: User | undefined

let meta: InstanceMeta | undefined
let metaFetchedAt = 0

const metaMaxAge = 6 * 60 * 60 * 1000

export async function fetchMeta() {
	metaFetchedAt = Date.now()
	return meta = await GetMeta.call().catch(() => undefined)
}

export async function refreshMetaIfStale() {
	if (Date.now() - metaFetchedAt > metaMaxAge) {
		await fetchMeta()
	}
	return meta
}

export function getMeta() {
	return meta
}

/** The operator's `MITRA_NAME`, else Mitra's own name in the current language. */
export function instanceName() {
	return meta?.name ?? String(t('Mitra'))
}

export function isBundleStale() {
	return !!meta && meta.version !== mitra.version
}

export async function fetchUser() {
	return currentUser = await GetUser.call()
}

export function getUser() {
	return currentUser
}

/** Keeps the user an operation answers with as the signed-in one, which `getUser` reads until the next. */
export async function keepUser(answer: Promise<User>) {
	return currentUser = await answer
}

export function getSettings(): UserSettings {
	return currentUser?.settings ?? {}
}

/** Stores a file for an entry to refer to. The body is the file itself, its type and name on the standard headers, so it bypasses the JSON transport. */
export async function uploadFile(file: globalThis.File) {
	const response = await fetch(Api.url + '/files', {
		method: 'POST',
		credentials: 'include',
		headers: {
			'accept': 'application/json',
			'content-type': file.type || 'application/octet-stream',
			'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
		},
		body: file,
	})
	if (response.status >= 400) {
		await new ApiError(response).throw()
	}
	return EntryFile.from(await response.json())!
}

export function connectGoogle() {
	location.assign('/api/integrations/google/connect')
}
