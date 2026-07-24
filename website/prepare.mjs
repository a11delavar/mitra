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

// 2 · The logo. The repo has exactly one (../assets/mitra.svg); copy it into the two places the site
//     consumes it (the sidebar mark and the favicon). Both copies are git-ignored — generated, never
//     committed — so the mark has a single source.
const logo = fs.readFileSync(path.join(repoRoot, 'assets/mitra.svg'))
for (const dest of ['src/assets/mitra.svg', 'public/favicon.svg']) {
	const full = path.join(here, dest)
	fs.mkdirSync(path.dirname(full), { recursive: true })
	fs.writeFileSync(full, logo)
}
