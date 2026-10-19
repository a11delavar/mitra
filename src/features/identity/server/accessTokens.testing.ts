import { Api } from '@a11d/api'

/** An access token as the API sends it, which the tests read. */
export interface SentAccessToken {
	readonly id: string
	readonly name: string
	readonly scope: string
	readonly hash: string
	readonly lastUsedAt?: string
}

export const createAccessToken = (name: string, scope: 'read' | 'write') =>
	Api.post<{ accessToken: SentAccessToken, token: string }>('/user/access-tokens', { name, scope })

export const listAccessTokens = () => Api.get<Array<SentAccessToken>>('/user/access-tokens')
