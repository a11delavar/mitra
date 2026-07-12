// Runtimes ship native Temporal incrementally: some expose a global `Temporal` whose `ZonedDateTime`
// still throws "Not yet implemented" for date-unit arithmetic (Node 26, e.g.). `@3mo/date-time`
// self-polyfills only when NO global Temporal exists at all (`globalThis.Temporal ??= …`), so a
// *partial* native implementation would slip through and break at runtime.
//
// So feature-detect rather than clobber: exercise the operations the app leans on and keep the native
// implementation when it's complete (browsers already are — it's the fast C++ path, no reason to run
// the JS polyfill over it), installing the polyfill only when native is absent or partial. This file is
// `inject`ed ahead of everything in every bundle (backend, frontend, tests), so the decision lands
// before `@3mo/date-time`'s own `??=`. Delete once every target runtime's Temporal is whole.
import { Temporal as TemporalPolyfill } from 'temporal-polyfill'

function nativeTemporalComplete(): boolean {
	try {
		// Probe the EXACT shape `@3mo/date-time` runs: a ZonedDateTime in the resolved locale calendar
		// (typically `gregory`) doing date-unit arithmetic. This is the load-bearing detail — Node 26's
		// native Temporal implements date-unit `add` for `iso8601` but still throws "Not yet implemented"
		// for `gregory`, so a probe on the ISO calendar passes yet the app then blows up. Browsers already
		// handle `gregory`, so they keep native; Node falls back to the polyfill until it catches up.
		const calendar = new Intl.DateTimeFormat().resolvedOptions().calendar
		const zoned = new globalThis.Temporal.ZonedDateTime(0n, 'UTC', calendar)
		zoned.add({ months: 1, days: 1 }).startOfDay()
		zoned.with({ day: 1 })
		return true
	} catch {
		return false
	}
}

if (typeof globalThis.Temporal === 'undefined' || !nativeTemporalComplete()) {
	globalThis.Temporal = TemporalPolyfill
}
