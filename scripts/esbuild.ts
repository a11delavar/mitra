import type { BuildOptions } from 'esbuild'
import { join } from 'path'
import fs from 'fs'
import { execSync } from 'child_process'
import favicons from 'favicons'

export const distDir = 'dist'

/**
 * The build's version identity, baked into every bundle on the `mitra` object (declared in
 * src/mitra.d.ts). Resolution order: the MITRA_VERSION env var (Docker builds — the image context has
 * no .git, so CI computes the string and threads it through a build ARG) → `git describe` (local builds
 * and dev: the tag when exactly on one, `v0.3.0-14-ga1b2c3d[-dirty]` otherwise, a bare hash before the
 * first tag) → `dev` (no git, no env — e.g. a source tarball).
 */
function resolveVersion() {
	if (process.env.MITRA_VERSION) {
		return process.env.MITRA_VERSION
	}
	try {
		return execSync('git describe --tags --dirty --always', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
	} catch {
		return 'dev'
	}
}

/** The exact commit, resolved like the version. Baked separately because `git describe` on a tagged
 * commit is just the tag — release builds would otherwise not know their hash (the About dialog links it). */
function resolveCommit() {
	if (process.env.MITRA_COMMIT) {
		return process.env.MITRA_COMMIT
	}
	try {
		return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
	} catch {
		return ''
	}
}

export const define = { mitra: JSON.stringify({ version: resolveVersion(), commit: resolveCommit() }) }

/** Injected into every bundle (backend, frontend, tests) — see the file's comment. */
export const inject = ['scripts/injectTemporalPolyfill.ts']

/**
 * Backend bundle. Dual CJS/ESM deps are resolved to their ESM `module` build (the `mainFields` order)
 * so the `@3mo/*` interop works; native bindings, DB drivers and `tsdav` stay external (loaded natively
 * by Node at runtime). Emitted two directories deep so `server.ts`'s `import.meta.dirname`-relative paths
 * (`../../data`, `../../dist`) resolve against the app root.
 */
export const backendOptions: BuildOptions = {
	entryPoints: ['src/backend/server.ts'],
	outfile: 'out/server/server.mjs',
	bundle: true,
	platform: 'node',
	format: 'esm',
	mainFields: ['module', 'main'],
	banner: { js: 'import { createRequire as __nodeCreateRequire } from \'node:module\'; const require = __nodeCreateRequire(import.meta.url);' },
	external: ['better-sqlite3', 'sqlite3', 'libsql', '@libsql/client', 'mariadb', 'mysql', 'mysql2', 'pg', 'oracledb', 'tedious', 'tsdav', 'web-push'],
	inject,
	define,
}

/** Frontend bundle — fully self-contained (no externals), code-split into `dist/`. `.svg` files
 * import as their markup string (the `text` loader), so brand logos live as editable files under
 * `assets/` and get inlined into the bundle — rendered with `unsafeHTML`, they keep `currentColor`
 * theming that an `<img>` couldn't. */
export const frontendOptions: BuildOptions = {
	entryPoints: ['./src/frontend/index.ts'],
	bundle: true,
	splitting: true,
	format: 'esm',
	legalComments: 'none',
	outdir: distDir,
	loader: { '.svg': 'text' },
	inject,
	define,
}

/** The service worker (push notifications) — its own tiny classic-script bundle: a worker registered
 * without `type: 'module'`, so it must not share the app's ESM chunks (and needs no polyfills). */
export const serviceWorkerOptions: BuildOptions = {
	entryPoints: ['./src/frontend/sw.ts'],
	outfile: join(distDir, 'sw.js'),
	bundle: true,
	format: 'iife',
	legalComments: 'none',
}

/** The single-page shell that boots the bundled frontend, plus the PWA statics — every icon, the web
 * app manifest (installability: what lets push notifications attribute to "Mitra" instead of the
 * browser, and what iOS requires for push at all), and the <head> links referencing them — all derived
 * from the ONE logo file, `assets/mitra.svg`. Replacing that file and rebuilding rebrands everything. */
export async function writeIndexHtml() {
	fs.mkdirSync(distDir, { recursive: true })

	const generated = await favicons('assets/mitra.svg', {
		appName: 'Mitra',
		appShortName: 'Mitra',
		appDescription: 'Your calendar and your tasks, in one place.',
		start_url: '/',
		display: 'standalone',
		theme_color: '#121314',
		background: '#ffffff',
		// Only the icons something actually consumes: install + notifications (Android/Chromium),
		// the iOS home screen, and the browser tab. No maskable variant on purpose: the provisional
		// logo is a transparent glyph, and a transparent maskable renders as a blob on a white disc.
		icons: {
			android: ['android-chrome-192x192.png', 'android-chrome-512x512.png'],
			appleIcon: ['apple-touch-icon.png'],
			favicons: ['favicon.ico', 'favicon-32x32.png'],
			appleStartup: false,
			windows: false,
			yandex: false,
		},
	})
	for (const { name, contents } of [...generated.images, ...generated.files]) {
		// `favicons` has no option for `display_override`, so patch it into the generated manifest:
		// browsers that support Window Controls Overlay drop the title bar and let the app paint into
		// it, while others fall back to plain `display: standalone`.
		if (name === 'manifest.webmanifest') {
			const manifest = JSON.parse(contents.toString())
			manifest.display_override = ['window-controls-overlay']
			fs.writeFileSync(join(distDir, name), JSON.stringify(manifest, null, 2))
			continue
		}
		fs.writeFileSync(join(distDir, name), contents)
	}

	// The manifest must be fetched WITH credentials: browsers omit cookies on manifest requests by
	// default (per spec), so behind a cookie-auth proxy (e.g. Traefik OIDC) the request 302s to the
	// login page and installability silently dies — no manifest, no install prompt, no "Install App".
	// The apple-touch-icon link is appended by hand — favicons drops it when the icon set is filtered.
	const head = [
		...generated.html,
		'<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
	].join('\n\t').replace('rel="manifest"', 'rel="manifest" crossorigin="use-credentials"')

	fs.writeFileSync(join(distDir, 'index.html'), `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Mitra</title>
	${head}
	<script type="module" src="/index.js"></script>
	<script></script>
</head>
<body>
</body>
</html>
`.trim())
}
