import { consola, LogLevels, LogTypes, type LogLevel } from 'consola'

/**
 * Application logger configured with environment log level.
 */

const levelsByName = new Map<string, number>([
	['silent', LogLevels.silent],
	['error', LogLevels.error],
	['warn', LogLevels.warn],
	['info', LogLevels.info],
	['debug', LogLevels.debug],
	['trace', LogLevels.trace],
])

/** Resolve `MITRA_LOG_LEVEL` environment variable to consola log level number. */
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

export const logLevel = resolveLevel(globalThis.process?.env?.MITRA_LOG_LEVEL)

export const logLevelName = [...levelsByName.entries()].find(([, value]) => value === logLevel)?.[0] ?? String(logLevel)

export const logger = consola.create({
	level: logLevel as LogLevel,
	defaults: { tag: 'App' },
	types: { ...LogTypes, verbose: { level: LogLevels.trace } },
})

export function createLogger(tag: string) {
	return logger.withTag(tag)
}

/** Check if the specified log tier is enabled under the active log level. */
export function logEnabled(tier: string): boolean {
	return levelsByName.get(tier)! <= logLevel
}
