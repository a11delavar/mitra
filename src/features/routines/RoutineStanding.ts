export type RoutineStandingCode = 'starting' | 'slipping' | 'back-on-track' | 'off-and-on' | 'on-track'

/**
 * How a routine goes, in a word, read from whether its last settled dates were kept, the same for every cadence: starting
 * on its first, slipping once the last was missed, back on track once kept after a miss, off and on with misses scattered,
 * else on track. One instance per standing, so they compare by identity.
 */
export class RoutineStanding {
	static readonly Starting = new RoutineStanding('starting')
	static readonly Slipping = new RoutineStanding('slipping')
	static readonly BackOnTrack = new RoutineStanding('back-on-track')
	static readonly OffAndOn = new RoutineStanding('off-and-on')
	static readonly OnTrack = new RoutineStanding('on-track')

	/** The standing of settled dates `kept` or not, in order. */
	static of(kept: ReadonlyArray<boolean>) {
		const missed = (from: number, to?: number) => kept.slice(from, to).filter(date => !date).length
		switch (true) {
			case kept.length < 3: return RoutineStanding.Starting
			case !kept.at(-1): return RoutineStanding.Slipping
			case missed(-4, -1) > 0: return RoutineStanding.BackOnTrack
			case missed(-10) > 1: return RoutineStanding.OffAndOn
			default: return RoutineStanding.OnTrack
		}
	}

	private constructor(readonly code: RoutineStandingCode) { }

	format() {
		switch (this.code) {
			case 'starting': return t('Starting')
			case 'slipping': return t('Slipping')
			case 'back-on-track': return t('Back on track')
			case 'off-and-on': return t('Off and on')
			case 'on-track': return t('On track')
		}
	}

	toString() {
		return this.code
	}
}
