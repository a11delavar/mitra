import { consola, LogLevels, LogTypes, type LogLevel } from 'consola'

/**
 * The application's logger (consola), with a single operator-tunable verbosity knob.
 *
 * The level is resolved once at boot from `MITRA_LOG_LEVEL` and, because {@link consola.withTag} spreads
 * the parent's options, every tagged child ({@link createLogger}) inherits it — the whole app honours one
 * setting. Tiers, quietest to loudest:
 *
 *  - **error** — failures the operator must act on: a crash, a sync/reminder tick that threw, a 5xx.
 *  - **warn**  — handled degradations: a push undelivered, a geocoder timeout, a rejected write, an
 *                OIDC discovery that failed and will be retried.
 *  - **info**  — *(default)* lifecycle milestones on a HEALTHY system: boot, sign-in/out, an integration
 *                connected, a sync that actually changed something, a reminder firing. Deliberately
 *                low-frequency — a quiet server is a healthy one, so info stays glanceable.
 *  - **debug** — per-operation trace for diagnosis: every request (method/path/status/ms), each sync
 *                tick, session resolution, entry CRUD, CalDAV round-trips. Opt-in; chatty by design.
 *  - **trace** — the firehose: SQL, `.ics` payloads, per-entry sync decisions. Emitted via `verbose`,
 *                not consola's stack-appending `trace` type (see the `types` remap below).
 *
 * Secrets — passwords, tokens, PKCE verifiers — are NEVER logged, at any level.
 */

const levelsByName = new Map<string, number>([
	['silent', LogLevels.silent],
	['error', LogLevels.error],
	['warn', LogLevels.warn],
	['info', LogLevels.info],
	['debug', LogLevels.debug],
	['trace', LogLevels.trace],
])

/** Resolve `MITRA_LOG_LEVEL` — a tier name (`debug`) or a raw consola number — to a level; default info. */
function resolveLevel(raw: string | undefined): number {
	const def = LogLevels.info
	if (!raw) {
		return def
	}
	const name = raw.trim().toLowerCase()
	if (levelsByName.has(name)) {
		return levelsByName.get(name)!
	}
	const numeric = Number(name)
	return Number.isFinite(numeric) ? numeric : def
}

/** The active level as a consola number (`3` = info). Compare against with {@link logEnabled}.
 * `Logger.ts` is shared code: `process` doesn't exist in the browser bundle (the frontend pulls this in
 * transitively via the shared models), so read the env var defensively — the frontend just gets `info`. */
export const logLevel = resolveLevel(globalThis.process?.env?.MITRA_LOG_LEVEL)

/** The active level's name, for advertising the current tier at boot (e.g. `info`). */
export const logLevelName = [...levelsByName.entries()].find(([, value]) => value === logLevel)?.[0] ?? String(logLevel)

export const logger = consola.create({
	level: logLevel as LogLevel,
	defaults: { tag: 'App' },
	// consola's `trace` TYPE appends a call stack (it mirrors `console.trace`) — right for a one-off "how
	// did we get here", wrong for a verbosity tier where every SQL line and .ics payload would drag a
	// stack behind it. So the loudest tier emits through `verbose` (same level 5, no stack) and nothing
	// calls `logger.trace()`. `types` REPLACES the defaults on create, hence the spread.
	types: { ...LogTypes, verbose: { level: LogLevels.trace } },
})

export function createLogger(tag: string) {
	return logger.withTag(tag)
}

/** Whether `tier` would be emitted at the active level — a cheap gate so callers can skip building an
 * expensive log string (serializing a payload for `trace`, say) that would only be discarded. The
 * `logger.verbose(...)` call itself already no-ops when hidden; this only avoids the WORK before it. */
export function logEnabled(tier: string): boolean {
	return levelsByName.get(tier)! <= logLevel
}
