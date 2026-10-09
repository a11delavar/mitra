import fs from 'node:fs'
import path from 'node:path'
import { lastCommitDate } from './git.mjs'

/**
 * A file's translation is the file beside it with the language before its extension: `docs/views/week.md` has
 * `docs/views/week.de.md`, `releases/0.6/README.md` has `README.de.md`. It is complete, or it does not exist.
 * @param {string} file repo-relative
 * @param {string} language
 */
export function translationOf(file, language) {
	return file.replace(/(\.mdx?)$/i, `.${language}$1`)
}

/**
 * Whether `file` reads in `language`: `missing`, `current`, or `outdated` once the English file was committed after
 * its translation last was. An uncommitted translation is current: it is being written against today's English.
 * @param {string} file repo-relative
 * @param {string} language
 * @param {string} root the repository
 * @returns {'missing' | 'current' | 'outdated'}
 */
export function translationState(file, language, root) {
	const translation = translationOf(file, language)
	if (!fs.existsSync(path.join(root, translation))) {
		return 'missing'
	}
	const english = lastCommitDate(file, root)
	const translated = lastCommitDate(translation, root)
	return english && translated && translated < english ? 'outdated' : 'current'
}
