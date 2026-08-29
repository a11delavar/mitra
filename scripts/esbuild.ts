import type { BuildOptions } from 'esbuild'
import { join } from 'path'
import { execSync } from 'child_process'

export const distDir = 'dist'

/** Resolves version string: MITRA_VERSION env -> git describe -> 'dev'. */
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

/** Resolves short git commit hash. */
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

const identity = { version: resolveVersion(), commit: resolveCommit() }

const defineFor = (runtime: 'server' | 'browser') => ({ mitra: JSON.stringify({ ...identity, runtime }) })

export const define = defineFor('server')

export const inject = ['scripts/injectTemporalPolyfill.ts']

/**
 * Backend bundle configuration with native node drivers and external dependencies.
 */
export const backendOptions: BuildOptions = {
	entryPoints: ['src/app/server.ts'],
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

/** Frontend client bundle configuration with code splitting and inlined SVG loaders. */
export const frontendOptions: BuildOptions = {
	entryPoints: [{ in: './src/app/client.ts', out: 'index' }],
	bundle: true,
	splitting: true,
	format: 'esm',
	legalComments: 'none',
	outdir: distDir,
	loader: { '.svg': 'text' },
	inject,
	define: defineFor('browser'),
}

/** Service worker bundle for Web Push notifications. */
export const serviceWorkerOptions: BuildOptions = {
	entryPoints: ['./src/app/serviceWorker.ts'],
	outfile: join(distDir, 'sw.js'),
	bundle: true,
	format: 'iife',
	legalComments: 'none',
	define: defineFor('browser'),
}
