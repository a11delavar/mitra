import { createLogger } from '../../../infrastructure/logging/Logger.js'
const logger = createLogger('Updates')

const repository = 'a11delavar/mitra'

/**
 * Update stream channel determined from version string.
 */
export type Channel =
	| { channel: 'release' | 'prerelease', current: string }
	| { channel: 'dev', sha: string }
	| { channel: 'none' }

export function detectChannel(version: string): Channel {
	if (version.endsWith('-dirty')) {
		return { channel: 'none' }
	}
	const describe = version.match(/^v\d+\.\d+\.\d+(?:-[\w.]+)?-\d+-g([0-9a-f]+)$/)
	if (describe) {
		return { channel: 'dev', sha: describe[1]! }
	}
	if (/^v\d+\.\d+\.\d+$/.test(version)) {
		return { channel: 'release', current: version }
	}
	if (/^v\d+\.\d+\.\d+-[\w.]+$/.test(version)) {
		return { channel: 'prerelease', current: version }
	}
	return { channel: 'none' }
}

function parseSemver(version: string) {
	const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([\w.]+))?$/)
	return !match ? undefined : { numbers: [Number(match[1]), Number(match[2]), Number(match[3])], prerelease: match[4] }
}

/** Determines if `candidate` is newer than `current` semver. */
export function isNewer(candidate: string, current: string) {
	const a = parseSemver(candidate)
	const b = parseSemver(current)
	if (!a || !b) {
		return false
	}
	for (let i = 0; i < 3; i++) {
		if (a.numbers[i] !== b.numbers[i]) {
			return a.numbers[i]! > b.numbers[i]!
		}
	}
	return !a.prerelease && !!b.prerelease
}

export interface UpdateInfo {
	version: string
	url: string
	commits?: number
}

type FetchJson = (url: string) => Promise<any>

/**
 * Background checker polling GitHub for available Mitra updates.
 */
export class UpdateChecker {
	static readonly initialDelay = process.env.MITRA_DEV === 'true' ? 2 * 1000 : 3 * 60 * 1000
	static readonly interval = 6 * 60 * 60 * 1000

	update?: UpdateInfo

	readonly channel: Channel

	private unreachableReported = false

	constructor(
		private readonly version: string = mitra.version,
		private readonly fetchJson: FetchJson = url => this.fetchJsonViaHttp(url),
	) {
		this.channel = detectChannel(version)
	}

	private get enabled() {
		return !['off', 'false', '0', 'no'].includes(process.env.MITRA_UPDATE_CHECK?.toLowerCase() ?? '')
	}

	start() {
		if (!this.enabled) {
			logger.info('Update checks disabled (MITRA_UPDATE_CHECK)')
			return
		}
		if (this.channel.channel === 'none') {
			logger.debug(`Update checks skipped: '${this.version}' names no update channel (dirty tree or unversioned build)`)
			return
		}
		setTimeout(() => {
			this.tick()
			setInterval(() => this.tick(), UpdateChecker.interval).unref()
		}, UpdateChecker.initialDelay).unref()
	}

	private async tick() {
		try {
			const update = await this.check()
			if (update && update.version !== this.update?.version) {
				logger.info(`Update available: ${update.version} (running ${this.version}) — ${update.url}`)
			}
			this.update = update
		} catch (error) {
			if (!this.unreachableReported) {
				this.unreachableReported = true
				logger.info('Update check could not reach GitHub — retrying quietly (set MITRA_UPDATE_CHECK=off to disable checks entirely)')
			}
			logger.debug('Update check failed:', error)
		}
	}

	check(): Promise<UpdateInfo | undefined> {
		switch (this.channel.channel) {
			case 'none': return Promise.resolve(undefined)
			case 'dev': return this.checkDev(this.channel.sha)
			default: return this.checkRelease(this.channel.current)
		}
	}

	private async checkRelease(current: string) {
		const latest = await this.fetchLatestRelease()
		return latest && isNewer(latest.version, current) ? latest : undefined
	}

	private async fetchLatestRelease(): Promise<UpdateInfo | undefined> {
		try {
			const manifest = await this.fetchJson(`https://github.com/${repository}/releases/latest/download/mitra.json`)
			if (typeof manifest?.version === 'string') {
				return { version: manifest.version, url: manifest.url || `https://github.com/${repository}/releases/tag/${manifest.version}` }
			}
		} catch { /* pre-manifest release — fall through */ }
		const release = await this.fetchJson(`https://api.github.com/repos/${repository}/releases/latest`)
		return typeof release?.tag_name !== 'string' ? undefined
			: { version: release.tag_name, url: release.html_url || `https://github.com/${repository}/releases/tag/${release.tag_name}` }
	}

	private async checkDev(sha: string): Promise<UpdateInfo | undefined> {
		const comparison = await this.fetchJson(`https://api.github.com/repos/${repository}/compare/${sha}...main`)
		const ahead = Number(comparison?.ahead_by)
		if (!ahead || !Number.isFinite(ahead)) {
			return undefined
		}
		return {
			version: comparison.commits?.at(-1)?.sha?.slice(0, 7) || 'main',
			url: comparison.html_url || `https://github.com/${repository}/compare/${sha}...main`,
			commits: ahead,
		}
	}

	private async fetchJsonViaHttp(url: string) {
		const response = await fetch(url, {
			headers: {
				'User-Agent': `Mitra/${this.version} (update-check; channel=${this.channel.channel}; +https://github.com/${repository})`,
				'Accept': 'application/json',
			},
			signal: AbortSignal.timeout(10_000),
		})
		if (!response.ok) {
			throw new Error(`GET ${url} → ${response.status}`)
		}
		return response.json()
	}
}

export const updateChecker = new UpdateChecker()
