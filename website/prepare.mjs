import fs from 'node:fs'
import path from 'node:path'

// Everything this docs site renders lives elsewhere in the repo — the Markdown in ../docs and the
// one logo in ../assets. This script wires those single sources of truth into the spots Astro and
// Starlight expect, so nothing is duplicated in version control. It runs before `dev` and `build`
// (see package.json) and is idempotent.
const here = import.meta.dirname
const repoRoot = path.resolve(here, '..')

// 1 · The docs collection. Starlight hardcodes `src/content/docs` (it derives git dates and page
//     language from that fixed path), so ../docs is linked in rather than pointed at directly — a
//     junction on Windows (no elevation), a directory symlink elsewhere.
const docsLink = path.join(here, 'src/content/docs')
fs.mkdirSync(path.dirname(docsLink), { recursive: true })
if (!fs.existsSync(docsLink)) {
	fs.symlinkSync(path.join(repoRoot, 'docs'), docsLink, process.platform === 'win32' ? 'junction' : 'dir')
}

// 2 · Assets & Logo. Copy ../assets into the places the site consumes them (the sidebar mark,
//     favicon, and static/content assets for markdown references).
const assetsDir = path.join(repoRoot, 'assets')
if (fs.existsSync(assetsDir)) {
	for (const dest of ['public/assets', 'src/assets', 'src/content/assets']) {
		const target = path.join(here, dest)
		fs.mkdirSync(target, { recursive: true })
		fs.cpSync(assetsDir, target, { recursive: true })
	}
}

const logo = fs.readFileSync(path.join(repoRoot, 'assets/mitra.svg'))
fs.writeFileSync(path.join(here, 'public/favicon.svg'), logo)
