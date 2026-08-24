import { spawn } from 'child_process'
import * as esbuild from 'esbuild'
import { backendOptions } from './esbuild.ts'

// Runs the migrations CLI (src/infrastructure/database/migrations/cli.ts) behind the `db:migration:*`
// scripts. The CLI imports the backend's entities, so it is bundled with the backend's exact build
// settings (decorators, polyfill injection, externals) and then executed — the same pattern as
// scripts/test.ts.
await esbuild.build({ ...backendOptions, entryPoints: ['src/infrastructure/database/migrations/cli.ts'], outfile: 'out/db/cli.mjs', sourcemap: 'inline' })
spawn('node', ['out/db/cli.mjs', ...process.argv.slice(2)], { stdio: 'inherit', shell: true })
