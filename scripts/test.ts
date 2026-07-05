import esbuild from 'esbuild'
import { glob } from 'node:fs/promises'
import { inject } from './esbuild.ts'

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
	external: ['tsdav'],
	sourcemap: 'inline',
	inject,
})
