import esbuild from 'esbuild'
import { glob, rm } from 'node:fs/promises'
import { backendOptions, define, inject, tsconfig } from './esbuild.ts'

const entryPoints = new Array<string>()
for await (const file of glob('src/**/*.test.ts')) {
	entryPoints.push(file)
}

// Built from scratch: a removed or renamed test would otherwise leave its old bundle behind, still run by `node --test`.
await rm('out_test', { recursive: true, force: true })

// Split, so the backend every server test imports is one chunk rather than a copy in each of their bundles, and with
// the source maps beside the files: inline, each bundle was 27 MB, 2.6 GB written and read back on every run.
await esbuild.build({
	entryPoints,
	outdir: 'out_test',
	bundle: true,
	splitting: true,
	chunkNames: 'chunks/[name]-[hash]',
	platform: 'node',
	format: 'esm',
	mainFields: ['module', 'main'],
	// createRequire shim for CJS dependencies with dynamic requires in ESM test bundle.
	banner: backendOptions.banner,
	external: ['tsdav', 'better-sqlite3', 'esbuild', 'typescript'],
	sourcemap: 'linked',
	inject,
	define,
	tsconfig,
})
