import { spawn } from 'child_process'
import * as esbuild from 'esbuild'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const tsgoPlatformDir = dirname(fileURLToPath(import.meta.resolve(`@typescript/native-preview-${process.platform}-${process.arch}/package.json`)))
spawn(join(tsgoPlatformDir, `lib/tsgo${process.platform === 'win32' ? '.exe' : ''}`), ['--noEmit', '--watch'], { stdio: 'inherit' })

// Bundle the backend with esbuild (rather than running it through tsx) so dual CJS/ESM dependencies
// resolve to their ESM `module` build — fixing the `intl-format-cache`/`@3mo/date-time` interop that
// tsx can't, which lets the backend use `DateTime` instead of `Date`. Output two directories deep so
// `server.ts`'s `import.meta.dirname`-relative paths (`../../data`, `../../dist`) match `src/backend`.
const backendContext = await esbuild.context({
	entryPoints: ['src/backend/server.ts'],
	outfile: 'out/server/server.mjs',
	bundle: true,
	platform: 'node',
	format: 'esm',
	mainFields: ['module', 'main'],
	sourcemap: 'inline',
	// A `require` for the CJS deps esbuild leaves as runtime requires (e.g. express requiring node builtins).
	banner: { js: `import { createRequire as __nodeCreateRequire } from 'node:module'; const require = __nodeCreateRequire(import.meta.url);` },
	// Native bindings, DB drivers, and tsdav (whose CJS deps misbehave when bundled) stay external —
	// loaded natively by Node. Only the browser-oriented `@3mo/*` graph needs bundling for the interop.
	external: ['better-sqlite3', 'sqlite3', 'libsql', '@libsql/client', 'mariadb', 'mysql', 'mysql2', 'pg', 'oracledb', 'tedious', 'tsdav'],
})
await backendContext.rebuild()
await backendContext.watch()
spawn('node', ['--watch', 'out/server/server.mjs'], { stdio: 'inherit', shell: true, env: { ...process.env, MITRA_DEV: 'true' } })

const directory = './dist'

if (!fs.existsSync(directory)) {
	fs.mkdirSync(directory, { recursive: true })
}
fs.writeFileSync(join(directory, 'index.html'), `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Mitra</title>
	<script type="module" src="/index.js"></script>
	<script></script>
</head>
<body>
</body>
</html>
`.trim())

const ctx = await esbuild.context({
	bundle: true,
	entryPoints: ['./src/frontend/index.ts'],
	splitting: true,
	format: 'esm',
	legalComments: 'none',
	sourcemap: 'inline',
	outdir: directory,
})

await ctx.watch()