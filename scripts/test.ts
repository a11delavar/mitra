import esbuild from 'esbuild'
import { glob } from 'node:fs/promises'
import { define, inject } from './esbuild.ts'

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
	external: ['tsdav', 'better-sqlite3', 'esbuild'],
	sourcemap: 'inline',
	inject,
	define,
})

