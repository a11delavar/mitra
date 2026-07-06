import { spawn } from 'child_process'
import * as esbuild from 'esbuild'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { backendOptions, frontendOptions, serviceWorkerOptions, writeIndexHtml } from './esbuild.ts'

const tsgoPlatformDir = dirname(fileURLToPath(import.meta.resolve(`@typescript/native-preview-${process.platform}-${process.arch}/package.json`)))
spawn(join(tsgoPlatformDir, `lib/tsgo${process.platform === 'win32' ? '.exe' : ''}`), ['--noEmit', '--watch'], { stdio: 'inherit' })

// Build + watch the backend, then run it (with the dev sample fixture). Shares its esbuild config with
// the production build (scripts/esbuild.ts), differing only by sourcemaps + watch.
const backendContext = await esbuild.context({ ...backendOptions, sourcemap: 'inline' })
await backendContext.rebuild()
await backendContext.watch()
spawn('node', ['--watch', 'out/server/server.mjs'], { stdio: 'inherit', shell: true, env: { ...process.env, MITRA_DEV: 'true' } })

await writeIndexHtml()

const ctx = await esbuild.context({ ...frontendOptions, sourcemap: 'inline' })
await ctx.watch()

const swContext = await esbuild.context({ ...serviceWorkerOptions, sourcemap: 'inline' })
await swContext.watch()
