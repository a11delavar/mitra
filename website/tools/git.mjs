import { execFileSync } from 'node:child_process'

const dates = new Map()

/**
 * When `file` (relative to `cwd`) was last committed, or undefined outside a git checkout. CI checks out the whole
 * history (`fetch-depth: 0`), or every date would be the newest commit's.
 * @param {string} file
 * @param {string} cwd
 * @returns {Date | undefined}
 */
export function lastCommitDate(file, cwd) {
	const key = `${cwd}\0${file}`
	if (!dates.has(key)) {
		let date
		try {
			const iso = execFileSync('git', ['log', '-1', '--format=%cI', '--', file], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
			date = iso ? new Date(iso) : undefined
		} catch {
			date = undefined
		}
		dates.set(key, date)
	}
	return dates.get(key)
}
