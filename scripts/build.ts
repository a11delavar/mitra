import * as esbuild from 'esbuild'
import { backendOptions, frontendOptions, serviceWorkerOptions } from './esbuild.ts'
import { writeIndexHtml } from './indexHtml.ts'
import { precompress } from './precompress.ts'

// One-shot production build (no watch, no dev server). Used by the Docker image and CI.
await esbuild.build({ ...backendOptions, sourcemap: false })
await writeIndexHtml()
await esbuild.build({ ...frontendOptions, minify: true, sourcemap: false })
await esbuild.build({ ...serviceWorkerOptions, minify: true, sourcemap: false })

const { files, raw, brotli } = await precompress()

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`
console.log('Built backend → out/server/server.mjs and frontend → dist/')
console.log(`Precompressed ${files} assets: ${mb(raw)} → ${mb(brotli)} brotli`)
