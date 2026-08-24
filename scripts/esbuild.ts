import type { BuildOptions } from 'esbuild'
import { join } from 'path'
import { execSync } from 'child_process'

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

const identity = { version: resolveVersion(), commit: resolveCommit() }

/**
 * The `mitra` object each bundle is built with. `runtime` is the one field that differs between them,
 * and it is a BUILD fact rather than something detected at run time: which of these bundles you are is
 * decided here and nowhere else, so nothing a process can be made to contain — a stray `window` global,
 * a shimming dependency — can change the answer.
 */
const defineFor = (runtime: 'server' | 'browser') => ({ mitra: JSON.stringify({ ...identity, runtime }) })

/** Node is the server: the backend bundle, the migrations CLI, and the test bundles all run there. */
export const define = defineFor('server')

/** Injected into every bundle (backend, frontend, tests) — see the file's comment. */
export const inject = ['scripts/injectTemporalPolyfill.ts']

/**
 * Backend bundle. Dual CJS/ESM deps are resolved to their ESM `module` build (the `mainFields` order)
 * so the `@3mo/*` interop works; native bindings, DB drivers and `tsdav` stay external (loaded natively
 * by Node at runtime). Emitted two directories deep so `server.ts`'s `import.meta.dirname`-relative paths
 * (`../../data`, `../../dist`) resolve against the app root.
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

/** Frontend bundle — fully self-contained (no externals), code-split into `dist/`. `.svg` files
 * import as their markup string (the `text` loader), so brand logos live as editable files under
 * `assets/` and get inlined into the bundle — rendered with `unsafeHTML`, they keep `currentColor`
 * theming that an `<img>` couldn't. */
export const frontendOptions: BuildOptions = {
	// `out: 'index'` keeps the emitted chunk at dist/index.js (the HTML shell's script src, and a
	// public asset name worth keeping stable) independent of the entry file's own name.
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

/** The service worker (push notifications) — its own tiny classic-script bundle: a worker registered
 * without `type: 'module'`, so it must not share the app's ESM chunks (and needs no polyfills). */
export const serviceWorkerOptions: BuildOptions = {
	entryPoints: ['./src/app/serviceWorker.ts'],
	outfile: join(distDir, 'sw.js'),
	bundle: true,
	format: 'iife',
	legalComments: 'none',
	// It needs no polyfills, but it IS a browser: should shared code ever reach it, it must not mistake
	// itself for the server.
	define: defineFor('browser'),
}
