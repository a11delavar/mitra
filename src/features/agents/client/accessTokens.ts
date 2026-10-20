import { Api } from '@a11d/api'
import type { AccessToken, AccessTokenScope } from '#features/identity'

/** Where agents connect, as this browser reaches the instance. */
export const mcpAddress = () => `${location.origin}/api/mcp`

/** Announced on the window when a token is made, so the list has it. */
export const accessTokenIssued = 'accessTokenIssued'

export const fetchAccessTokens = () => Api.get<Array<AccessToken>>('/user/access-tokens')

export const createAccessToken = (name: string, scope: AccessTokenScope) =>
	Api.post<{ accessToken: AccessToken, token: string }>('/user/access-tokens', { name, scope })

export const revokeAccessToken = (id: string) => Api.delete(`/user/access-tokens/${id}`)
