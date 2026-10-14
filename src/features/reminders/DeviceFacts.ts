interface UserAgentData {
	platform?: string
	mobile?: boolean
	brands?: Array<{ brand: string, version: string }>
}

/** What a browser says about itself, stored raw on its push subscription. Dependency-free for the service worker. */
export class DeviceFacts {
	/** Chromium lists its engine and a decoy with a random spelling ("Not=A?Brand", "Not_A Brand") beside the real brand. */
	private static readonly decoy = /^(Chromium|Not.A.Brand)$/

	/** The facts of the browser running this, from its Client Hints where it has them. */
	static current(navigator: Navigator & { userAgentData?: UserAgentData } = globalThis.navigator): DeviceFacts {
		const data = navigator.userAgentData
		const fallback = DeviceFacts.fromUserAgent(navigator.userAgent)
		return !data ? fallback : new DeviceFacts(
			data.platform || fallback.platform,
			(data.brands && DeviceFacts.brandOf(data.brands)) || fallback.browser,
			data.mobile ?? fallback.mobile,
		)
	}

	/** The brand among Client Hints' brands: Edge rather than the Chrome it also claims to be. */
	static brandOf(brands: ReadonlyArray<{ brand: string }>): string | undefined {
		const named = brands.map(entry => entry.brand).filter(brand => !DeviceFacts.decoy.test(brand))
		return named.find(brand => brand !== 'Google Chrome') ?? named[0]
	}

	/** Safari and Firefox have no User-Agent Client Hints. */
	static fromUserAgent(agent: string): DeviceFacts {
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
		return new DeviceFacts(platform, browser, /Mobi|Android|iPhone|iPad|iPod/.test(agent))
	}

	constructor(
		readonly platform?: string,
		readonly browser?: string,
		readonly mobile?: boolean,
	) { }
}
