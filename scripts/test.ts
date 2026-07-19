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
	// Prefer each dependency's ESM build so default-import interop matches what the app's bundler sees.
	mainFields: ['module', 'main'],
	// `better-sqlite3` is a native module (it dynamically `require`s `fs`/bindings) and can't be
	// bundled — kept external, as the app build does, so tests may spin up a real in-memory ORM.
	external: ['tsdav', 'better-sqlite3'],
	sourcemap: 'inline',
	inject,
	define,
})
