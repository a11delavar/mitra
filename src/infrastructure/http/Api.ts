import { Api, HttpError, apiError, apiAuthenticator, type ApiAuthenticator } from '@a11d/api'
import { EntryFile } from '#features/entries'

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
