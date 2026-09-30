/** What a browser says about itself, stored raw on its push subscription. Dependency-free for the service worker. */
export interface DeviceFacts {
	platform?: string
	browser?: string
	mobile?: boolean
}

interface UserAgentData {
	platform?: string
	mobile?: boolean
	brands?: Array<{ brand: string, version: string }>
}

/** Chromium lists its engine and a decoy with a random spelling ("Not=A?Brand", "Not_A Brand") beside the real brand. */
const decoy = /^(Chromium|Not.A.Brand)$/

export function brandOf(brands: ReadonlyArray<{ brand: string }>): string | undefined {
	const named = brands.map(entry => entry.brand).filter(brand => !decoy.test(brand))
	return named.find(brand => brand !== 'Google Chrome') ?? named[0]
}

/** Safari and Firefox have no User-Agent Client Hints. */
function fromUserAgent(agent: string): DeviceFacts {
	const platform = /iPhone|iPod/.test(agent) ? 'iOS'
		: /iPad/.test(agent) ? 'iPadOS'
			: /Android/.test(agent) ? 'Android'
				: /Macintosh|Mac OS X/.test(agent) ? 'macOS'
					: /Windows/.test(agent) ? 'Windows'
						: /CrOS/.test(agent) ? 'Chrome OS'
							: /Linux/.test(agent) ? 'Linux'
								: undefined
	const browser = /Edg\//.test(agent) ? 'Microsoft Edge'
		: /OPR\//.test(agent) ? 'Opera'
			: /Firefox\//.test(agent) ? 'Firefox'
				: /Chrome\//.test(agent) ? 'Google Chrome'
					: /Safari\//.test(agent) ? 'Safari'
						: undefined
	return { platform, browser, mobile: /Mobi|Android|iPhone|iPad|iPod/.test(agent) }
}

export function deviceFacts(): DeviceFacts {
	const data = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData
	const fallback = fromUserAgent(navigator.userAgent)
	if (!data) {
		return fallback
	}
	return {
		platform: data.platform || fallback.platform,
		browser: (data.brands && brandOf(data.brands)) || fallback.browser,
		mobile: data.mobile ?? fallback.mobile,
	}
}
