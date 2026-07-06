import type { BuildOptions } from 'esbuild'
import { join } from 'path'
import fs from 'fs'
import { iconPng } from './icon.ts'

export const distDir = 'dist'

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
}

/** Frontend bundle — fully self-contained (no externals), code-split into `dist/`. */
export const frontendOptions: BuildOptions = {
	entryPoints: ['./src/frontend/index.ts'],
	bundle: true,
	splitting: true,
	format: 'esm',
	legalComments: 'none',
	outdir: distDir,
	inject,
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

/** The single-page shell that boots the bundled frontend, plus the PWA statics: the web app manifest
 * (installability — which is also what makes push notifications attribute to "Mitra" instead of the
 * browser, and what iOS requires for push at all) and the generated icons (scripts/icon.ts). */
export function writeIndexHtml() {
	fs.mkdirSync(distDir, { recursive: true })
	fs.writeFileSync(join(distDir, 'index.html'), `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta name="theme-color" content="#121314">
	<title>Mitra</title>
	<link rel="manifest" href="/manifest.webmanifest">
	<link rel="icon" type="image/png" href="/icon-192.png">
	<link rel="apple-touch-icon" href="/icon-192.png">
	<script type="module" src="/index.js"></script>
	<script></script>
</head>
<body>
</body>
</html>
`.trim())
	fs.writeFileSync(join(distDir, 'manifest.webmanifest'), JSON.stringify({
		name: 'Mitra',
		short_name: 'Mitra',
		description: 'Your calendar and your tasks, in one place.',
		start_url: '/',
		display: 'standalone',
		background_color: '#121314',
		theme_color: '#121314',
		// No `maskable` variant on purpose: the provisional icon is a transparent glyph (see
		// scripts/icon.ts), and a transparent maskable renders as a blob on a white disc on Android.
		// Re-add one alongside a designed, full-bleed icon.
		icons: [
			{ src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
			{ src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
		],
	}, undefined, '\t'))
	fs.writeFileSync(join(distDir, 'icon-192.png'), iconPng(192))
	fs.writeFileSync(join(distDir, 'icon-512.png'), iconPng(512))
}
