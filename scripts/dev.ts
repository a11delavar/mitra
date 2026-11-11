import { spawn } from 'child_process'
import * as esbuild from 'esbuild'
import { backendOptions, frontendOptions, resolveVersion, serviceWorkerOptions } from './esbuild.ts'
import { writeIndexHtml } from './indexHtml.ts'
import { writeReleaseAssets } from './releaseAssets.ts'

// The type checker's watcher holds gigabytes, so it runs only when asked (`npm start -- --typecheck`).
if (process.argv.includes('--typecheck')) {
	spawn('npm', ['run', 'typecheck', '--', '--watch'], { stdio: 'inherit', shell: true })
}

// Build, watch, and run backend with dev fixtures.
const backendContext = await esbuild.context({ ...backendOptions, sourcemap: 'inline' })
await backendContext.rebuild()
await backendContext.watch()
spawn('node', ['--watch', 'out/server/server.mjs'], { stdio: 'inherit', shell: true, env: { ...process.env, MITRA_DEV: 'true' } })

await writeIndexHtml()
writeReleaseAssets(resolveVersion())

const ctx = await esbuild.context({ ...frontendOptions, sourcemap: 'inline' })
await ctx.watch()

const swContext = await esbuild.context({ ...serviceWorkerOptions, sourcemap: 'inline' })
await swContext.watch()
