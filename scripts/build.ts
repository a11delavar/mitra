import * as esbuild from 'esbuild'
import { backendOptions, frontendOptions, serviceWorkerOptions, writeIndexHtml } from './esbuild.ts'

// One-shot production build (no watch, no dev server). Used by the Docker image and CI.
await esbuild.build({ ...backendOptions, sourcemap: false })
writeIndexHtml()
await esbuild.build({ ...frontendOptions, minify: true, sourcemap: false })
await esbuild.build({ ...serviceWorkerOptions, minify: true, sourcemap: false })

console.log('Built backend → out/server/server.mjs and frontend → dist/')
