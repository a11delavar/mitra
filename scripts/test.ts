import esbuild from 'esbuild'
import { glob, rm } from 'node:fs/promises'
import { backendOptions, define, inject } from './esbuild.ts'

const entryPoints = new Array<string>()
for await (const file of glob('src/**/*.test.ts')) {
	entryPoints.push(file)
}

// Built from scratch: a removed or renamed test would otherwise leave its old bundle behind, still run by `node --test`.
await rm('out_test', { recursive: true, force: true })

await esbuild.build({
	entryPoints,
	outdir: 'out_test',
	bundle: true,
	platform: 'node',
	format: 'esm',
	mainFields: ['module', 'main'],
	// createRequire shim for CJS dependencies with dynamic requires in ESM test bundle.
	banner: backendOptions.banner,
	external: ['tsdav', 'better-sqlite3', 'esbuild'],
	sourcemap: 'inline',
	inject,
	define,
})

