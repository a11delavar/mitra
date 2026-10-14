import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DeviceFacts } from './DeviceFacts.js'

const iPhone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const edgeOnWindows = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0'
const firefoxOnLinux = 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0'
const chromeOnAndroid = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'

const facts = (device: DeviceFacts) => ({ ...device })

describe('DeviceFacts', () => {
	describe('brandOf', () => {
		const brands = (...names: Array<string>) => names.map(brand => ({ brand }))

		it('skips the engine and the decoy, whatever its spelling', () => {
			assert.equal(DeviceFacts.brandOf(brands('Not=A?Brand', 'Chromium', 'Google Chrome')), 'Google Chrome')
			assert.equal(DeviceFacts.brandOf(brands('Chromium', 'Not_A Brand', 'Microsoft Edge')), 'Microsoft Edge')
			assert.equal(DeviceFacts.brandOf(brands('Not/A)Brand', 'Chromium', 'Opera')), 'Opera')
		})

		it('names Edge rather than the Chrome it also claims to be', () => {
			assert.equal(DeviceFacts.brandOf(brands('Microsoft Edge', 'Google Chrome', 'Not;A=Brand')), 'Microsoft Edge')
		})

		it('has nothing to name when only the engine is listed', () => {
			assert.equal(DeviceFacts.brandOf(brands('Chromium', 'Not.A/Brand')), undefined)
		})
	})

	describe('fromUserAgent', () => {
		it('reads the platform, the browser and whether it is mobile', () => {
			assert.deepEqual(facts(DeviceFacts.fromUserAgent(iPhone)), { platform: 'iOS', browser: 'Safari', mobile: true })
			assert.deepEqual(facts(DeviceFacts.fromUserAgent(edgeOnWindows)), { platform: 'Windows', browser: 'Microsoft Edge', mobile: false })
			assert.deepEqual(facts(DeviceFacts.fromUserAgent(firefoxOnLinux)), { platform: 'Linux', browser: 'Firefox', mobile: false })
			assert.deepEqual(facts(DeviceFacts.fromUserAgent(chromeOnAndroid)), { platform: 'Android', browser: 'Google Chrome', mobile: true })
		})

		it('names nothing it does not recognize', () => {
			assert.deepEqual(facts(DeviceFacts.fromUserAgent('curl/8.0')), { platform: undefined, browser: undefined, mobile: false })
		})
	})

	describe('current', () => {
		const navigatorOf = (userAgent: string, userAgentData?: object) => ({ userAgent, userAgentData }) as never

		it('prefers Client Hints, filling their gaps from the user agent', () => {
			const device = DeviceFacts.current(navigatorOf(edgeOnWindows, { platform: '', mobile: undefined, brands: [{ brand: 'Chromium' }, { brand: 'Opera' }] }))
			assert.deepEqual(facts(device), { platform: 'Windows', browser: 'Opera', mobile: false })
		})

		it('reads the user agent alone where there are no Client Hints', () => {
			assert.deepEqual(facts(DeviceFacts.current(navigatorOf(iPhone))), { platform: 'iOS', browser: 'Safari', mobile: true })
		})
	})
})
