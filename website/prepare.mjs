import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { base, docsBase } from './site.mjs'
import { emitTokens } from './tools/tokens.mjs'

// Wires the repo's single sources (../docs, ../assets, ../src/design) into where Astro expects
// them. Runs before `dev` and `build`; everything it writes is gitignored.
const here = import.meta.dirname
const repoRoot = path.resolve(here, '..')
const write = (file, content) => {
	fs.mkdirSync(path.dirname(path.join(here, file)), { recursive: true })
	fs.writeFileSync(path.join(here, file), content)
}

// Starlight hardcodes `src/content/docs`, so ../docs is linked in, one level deep, which is what
// puts every page under /docs/ without moving a file. A junction on Windows needs no elevation.
const docsLink = path.join(here, 'src/content/docs', docsBase)
fs.mkdirSync(path.dirname(docsLink), { recursive: true })
if (!fs.existsSync(docsLink)) {
	fs.symlinkSync(path.join(repoRoot, 'docs'), docsLink, process.platform === 'win32' ? 'junction' : 'dir')
}

// The logo and the captures the pages import (Astro converts and hashes those).
fs.cpSync(path.join(repoRoot, 'assets'), path.join(here, 'src/assets'), { recursive: true })
write('public/favicon.svg', fs.readFileSync(path.join(repoRoot, 'assets/mitra.svg')))

// The docs' screenshots are raw HTML, which Astro's image pipeline never sees, so their web-sized
// copies are made here for `remarkDocsAssets` to point at.
const shots = path.join(repoRoot, 'assets/screenshots')
const webp = path.join(here, 'public/assets/screenshots')
fs.mkdirSync(webp, { recursive: true })
await Promise.all(fs.readdirSync(shots).filter(name => name.endsWith('.png')).map(async name => {
	const source = path.join(shots, name)
	const output = path.join(webp, name.replace(/\.png$/, '.webp'))
	if (!fs.existsSync(output) || fs.statSync(output).mtimeMs < fs.statSync(source).mtimeMs) {
		await sharp(source).resize({ width: 1800, withoutEnlargement: true }).webp({ quality: 88 }).toFile(output)
	}
}))

// Starlight looks for the not-found page in the docs collection, but it is no operator doc.
write('src/content/docs/404.md', `---
title: Not found
description: That page does not exist.
template: splash
editUrl: false
---

This page doesn't exist. It may have moved, or the link may be out of date.

- [Documentation](${base}/${docsBase}/)
- [Installation](${base}/${docsBase}/getting-started/installation/)
- [Home](${base}/)
`)

// Each integration's own logo, so a new one shows up on the homepage without touching the site.
for (const entry of fs.readdirSync(path.join(repoRoot, 'src/integrations'), { withFileTypes: true })) {
	const logo = path.join(repoRoot, 'src/integrations', entry.name, 'logo.svg')
	if (entry.isDirectory() && fs.existsSync(logo)) {
		write(`src/logos/${entry.name}.svg`, fs.readFileSync(logo))
	}
}

// A module, not a runtime read: components are bundled, so `import.meta` paths point into dist.
const { version } = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
write('src/generated/meta.json', `${JSON.stringify({ version }, null, '\t')}\n`)

await emitTokens()
