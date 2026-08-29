import { spawn } from 'child_process'
import * as esbuild from 'esbuild'
import { backendOptions } from './esbuild.ts'

// Bundles and executes the migrations CLI using backend build settings.
await esbuild.build({ ...backendOptions, entryPoints: ['src/infrastructure/database/migrations/cli.ts'], outfile: 'out/db/cli.mjs', sourcemap: 'inline' })
spawn('node', ['out/db/cli.mjs', ...process.argv.slice(2)], { stdio: 'inherit', shell: true })
