import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { GoogleCalendar } from './GoogleCalendar.js'
import { Source, SourceType } from './Source.js'

const account = () => new GoogleCalendar({
	uri: GoogleCalendar.uriFor('someone@gmail.com'),
	credentials: { username: 'someone@gmail.com', refreshToken: 'grant-1' },
	sources: [new Source({ uri: 'https://g/cal/events/', type: SourceType.Event, name: 'Personal', enabled: true })] as any,
})

describe('GoogleCalendar', () => {
	describe('uriFor', () => {
		it('builds the per-account calendar home (the (userId, uri) identity)', () => {
			assert.equal(GoogleCalendar.uriFor('someone@gmail.com'), 'https://apidata.googleusercontent.com/caldav/v2/someone%40gmail.com/')
		})
	})

	describe('merge', () => {
		it('keeps the stored grant — nothing is form-editable', () => {
			const integration = account()
			integration.merge(new GoogleCalendar({ uri: 'https://evil.example.com/', credentials: { username: 'other@gmail.com', refreshToken: '' } }))
			assert.equal(integration.uri, GoogleCalendar.uriFor('someone@gmail.com'))
			assert.deepEqual(integration.credentials, { username: 'someone@gmail.com', refreshToken: 'grant-1' })
		})
	})

	describe('toJSON', () => {
		it('serves the account label but never the refresh token', () => {
			const json = JSON.parse(JSON.stringify(account()))
			assert.equal(json['@type'], 'GoogleCalendar')
			assert.deepEqual(json.credentials, { username: 'someone@gmail.com' })
		})
	})

	describe('syncInterval', () => {
		it('polls more politely than the default cadence (Google quotas)', () => {
			assert.ok(account().syncInterval >= 60_000)
		})
	})

	describe('editableCopy', () => {
		it('is a polymorphic copy for the edit form: same provider class, grant blanked, sources plain', () => {
			const copy = account().editableCopy()
			assert.ok(copy instanceof GoogleCalendar) // the dialog round-trips the right '@type' without knowing providers
			assert.equal(copy.uri, GoogleCalendar.uriFor('someone@gmail.com'))
			assert.deepEqual(copy.credentials, { username: 'someone@gmail.com', refreshToken: '' })
			assert.ok(Array.isArray(copy.sources)) // plain array — JSON-serializable, no circular Collection owner
			assert.deepEqual([...copy.sources].map(source => [source.name, source.enabled]), [['Personal', true]])
		})
	})

	describe('clientParameters', () => {
		const env = { clientId: process.env.MITRA_GOOGLE_CLIENT_ID, clientSecret: process.env.MITRA_GOOGLE_CLIENT_SECRET }
		beforeEach(() => {
			process.env.MITRA_GOOGLE_CLIENT_ID = 'client-id'
			process.env.MITRA_GOOGLE_CLIENT_SECRET = 'client-secret'
		})
		afterEach(() => {
			env.clientId === undefined ? delete process.env.MITRA_GOOGLE_CLIENT_ID : process.env.MITRA_GOOGLE_CLIENT_ID = env.clientId
			env.clientSecret === undefined ? delete process.env.MITRA_GOOGLE_CLIENT_SECRET : process.env.MITRA_GOOGLE_CLIENT_SECRET = env.clientSecret
		})

		it('speaks OAuth against the fixed Google endpoint, not the per-account uri', () => {
			const parameters = (account() as any).clientParameters
			assert.equal(parameters.authMethod, 'Oauth')
			assert.equal(parameters.serverUrl, GoogleCalendar.serverUrl)
			assert.equal(parameters.credentials.tokenUrl, GoogleCalendar.tokenUrl)
			assert.equal(parameters.credentials.username, 'someone@gmail.com')
			assert.equal(parameters.credentials.refreshToken, 'grant-1')
			assert.equal(parameters.credentials.clientId, 'client-id')
			assert.equal(parameters.credentials.clientSecret, 'client-secret')
		})

		it('hands tsdav a copy, so its in-place token caching never touches the persisted credentials', () => {
			const integration = account()
			const parameters = (integration as any).clientParameters
			parameters.credentials.accessToken = 'minted'
			assert.equal((integration.credentials as any).accessToken, undefined)
			assert.equal((integration.credentials as any).clientSecret, undefined)
		})

		it('fails loudly when the deployment is not configured', () => {
			delete process.env.MITRA_GOOGLE_CLIENT_ID
			assert.throws(() => (account() as any).clientParameters, /MITRA_GOOGLE_CLIENT_ID/)
		})
	})
})
