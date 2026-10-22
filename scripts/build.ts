import * as esbuild from 'esbuild'
import { backendOptions, frontendOptions, resolveVersion, serviceWorkerOptions } from './esbuild.ts'
import { writeIndexHtml } from './indexHtml.ts'
import { precompress, removePrecompressed } from './precompress.ts'
import { writeReleaseAssets } from './releaseAssets.ts'

// One-shot production build (no watch, no dev server). Used by the Docker image and CI.
await esbuild.build({ ...backendOptions, sourcemap: false })
await writeIndexHtml()
await esbuild.build({ ...frontendOptions, minify: true, sourcemap: false })
await esbuild.build({ ...serviceWorkerOptions, minify: true, sourcemap: false })
writeReleaseAssets(resolveVersion())
console.log('Built backend → out/server/server.mjs and frontend → dist/')

// Compressing takes a minute and a half, which the captures, served locally, skip with --no-compress.
if (process.argv.includes('--no-compress')) {
	await removePrecompressed()
} else {
	const { files, raw, brotli } = await precompress()
	const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`
	console.log(`Precompressed ${files} assets: ${mb(raw)} → ${mb(brotli)} brotli`)
}
