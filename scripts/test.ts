import esbuild from 'esbuild'
import { glob } from 'node:fs/promises'
import { backendOptions, define, inject } from './esbuild.ts'

const entryPoints = new Array<string>()
for await (const file of glob('src/**/*.test.ts')) {
	entryPoints.push(file)
}

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

