import { createLogger } from '../shared/index.js'

const logger = createLogger('Updates')

/** Where updates come from — every URL the checker touches or surfaces hangs off this. */
const repository = 'a11delavar/mitra'

/**
 * Which update stream a build belongs to, judged from its baked version string (the same shapes
 * `Sidebar.versionLabel` distinguishes):
 *
 * - `release` — exactly on a stable tag (`v1.2.3`): a newer stable release means an update.
 * - `prerelease` — on a pre-release tag (`v1.2.3-rc.1`): watches for the STABLE that supersedes it.
 * - `dev` — a `git describe` string past a tag (`v1.2.3-14-gabc1234`): the rolling `:dev` image;
 *   commits on main past the baked commit mean a newer dev build exists.
 * - `none` — dirty trees, the git-less `dev` fallback, bare hashes: nothing to compare against,
 *   so update checks are skipped entirely.
 */
export type Channel =
	| { channel: 'release' | 'prerelease', current: string }
	| { channel: 'dev', sha: string }
	| { channel: 'none' }

export function detectChannel(version: string): Channel {
	if (version.endsWith('-dirty')) {
		return { channel: 'none' }
	}
	// The describe shape must be tried first: its `-14-gabc1234` tail would otherwise read as a
	// pre-release identifier. `[\w.]` can't cross a `-`, so a real pre-release tag in front of the
	// tail (`v1.0.0-rc.1-14-gabc1234`) still lands here.
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

/** Whether `candidate` supersedes `current` — plain numeric semver, plus the one pre-release rule
 * this feature needs: the stable of the same triplet supersedes its own pre-releases
 * (`v1.0.0` > `v1.0.0-rc.1`), while pre-release identifiers are never ranked among themselves. */
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

/** What `/api/meta` reports when something newer exists (see meta.ts) — absent otherwise. */
export interface UpdateInfo {
	version: string
	url: string
	/** Dev channel only: how many commits main is ahead of the running build. */
	commits?: number
}

type FetchJson = (url: string) => Promise<any>

/**
 * Polls GitHub for something newer than the running build — the single documented piece of outbound
 * traffic a Mitra instance produces (README: "Update checks"). One poll per INSTANCE, not per open
 * tab: the browser never talks to GitHub, it just reads the cached result off `/api/meta`.
 */
export class UpdateChecker {
	/** Boot must never depend on the network — the first check waits this out. Dev instances
	 * (MITRA_DEV) skip the wait so the indicator is testable in seconds, not minutes. */
	static readonly initialDelay = process.env.MITRA_DEV === 'true' ? 2 * 1000 : 3 * 60 * 1000
	static readonly interval = 6 * 60 * 60 * 1000

	/** The last successful check's verdict; kept in memory only, kept across FAILED re-checks so a
	 * transient outage never blinks an already-shown indicator away. */
	update?: UpdateInfo

	readonly channel: Channel

	private unreachableReported = false

	constructor(
		private readonly version: string = mitra.version,
		private readonly fetchJson: FetchJson = url => this.fetchJsonViaHttp(url),
	) {
		this.channel = detectChannel(version)
	}

	/** `MITRA_UPDATE_CHECK: 'off'` is the kill switch (README documents it beside MITRA_NAME). */
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
		// Unref'd so pending timers never hold a shutting-down process open.
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
			// Air-gapped instances live in this branch forever — one info line ever, debug afterwards,
			// so an instance that simply can't reach GitHub never warn-spams its logs.
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

	/**
	 * The latest stable release, manifest-first: every release ships a tiny `mitra.json` asset (see
	 * release.yml), and `releases/latest/download/…` resolves it without the API. Asset downloads are
	 * the one request GitHub COUNTS (per-release `download_count`, readable by anyone) — the project's
	 * only ambient adoption signal — so the manifest is preferred; releases from before the asset
	 * existed 404 into the releases API, which answers the same question but counts nothing.
	 * Both roads exclude drafts and pre-releases, matching release.yml's pre-release marking.
	 */
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

	/** Dev builds compare their baked commit against main: `ahead_by` > 0 means newer `:dev` images
	 * have been (or are about to be) published. The describe sha is accepted by the compare API as-is. */
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

	/** GitHub requires a User-Agent; this one names the build and its channel. GitHub itself never
	 * shows it to anyone — but should the check URL ever be fronted by an owned endpoint, the
	 * differentiation (version, channel) is already flowing without a client change. */
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
