/** Which updates a build looks for: newer releases, newer commits on main, or none for a build of local changes. */
export type Channel =
	| { channel: 'release' | 'prerelease', current: string }
	| { channel: 'dev', sha: string }
	| { channel: 'none' }

/**
 * A version of Mitra as its tags and `git describe` write it: `v0.7.0`, `0.7.0-rc.1`, `v0.7.0-3-gabc1234` three commits
 * past a tag, `-dirty` with local changes. Pure, shared by the server, the release scripts and the app.
 */
export class Version {
	// The pre-release is lazy, so a describe suffix (`-3-gabc1234`) is never read as one.
	private static readonly pattern = /^v?(\d+)\.(\d+)\.(\d+)(?:-([\w.]+?))?(?:-(\d+)-g([0-9a-f]+))?$/

	static parse(value: string): Version | undefined {
		const dirty = value.endsWith('-dirty')
		const match = (dirty ? value.slice(0, -'-dirty'.length) : value).match(Version.pattern)
		return !match ? undefined : new Version(
			value,
			[Number(match[1]), Number(match[2]), Number(match[3])],
			match[4],
			match[6],
			dirty,
		)
	}

	private readonly value: string
	readonly numbers: readonly [major: number, minor: number, patch: number]
	readonly prerelease: string | undefined
	/** The commit a build past a tag was made from. */
	readonly commit: string | undefined
	readonly dirty: boolean

	// Plain fields, not parameter properties: the dev and release scripts run this through Node's type stripping.
	private constructor(value: string, numbers: Version['numbers'], prerelease: string | undefined, commit: string | undefined, dirty: boolean) {
		this.value = value
		this.numbers = numbers
		this.prerelease = prerelease
		this.commit = commit
		this.dirty = dirty
	}

	get patch() {
		return this.numbers[2]
	}

	/** `0.6` for `v0.6.2`: the release it belongs to, whose notes live in `releases/0.6`. */
	get release() {
		return `${this.numbers[0]}.${this.numbers[1]}`
	}

	/** Whether it ships its release's notes (`x.y.0`, pre-release allowed) rather than patching them. */
	get startsRelease() {
		return this.patch === 0
	}

	/** Whether it is exactly a tag: not a build past one, nor one with local changes. */
	get isTagged() {
		return !this.commit && !this.dirty
	}

	/** `0.7.0-rc.1` for `v0.7.0-rc.1`, as the changelog heads its section. */
	get tag() {
		return this.numbers.join('.') + (this.prerelease ? `-${this.prerelease}` : '')
	}

	get channel(): Channel {
		return this.dirty ? { channel: 'none' }
			: this.commit ? { channel: 'dev', sha: this.commit }
				: { channel: this.prerelease ? 'prerelease' : 'release', current: this.value }
	}

	/** Semver precedence, where a release is newer than its own pre-releases and pre-releases never outrank each other. */
	isNewerThan(other: Version) {
		const differing = this.numbers.findIndex((number, index) => number !== other.numbers[index])
		return differing >= 0 ? this.numbers[differing]! > other.numbers[differing]! : !this.prerelease && !!other.prerelease
	}

	toString() {
		return this.value
	}
}
