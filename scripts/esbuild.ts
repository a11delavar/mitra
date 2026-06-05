import type { BuildOptions } from 'esbuild'
import { join } from 'path'
import fs from 'fs'

export const distDir = 'dist'

/**
 * Backend bundle. Dual CJS/ESM deps are resolved to their ESM `module` build (the `mainFields` order)
 * so the `@3mo/*` interop works; native bindings, DB drivers and `tsdav` stay external (loaded natively
 * by Node at runtime). Emitted two directories deep so `server.ts`'s `import.meta.dirname`-relative paths
 * (`../../data`, `../../dist`) resolve against the app root.
 */
export const backendOptions: BuildOptions = {
	entryPoints: ['src/backend/server.ts'],
	outfile: 'out/server/server.mjs',
	bundle: true,
	platform: 'node',
	format: 'esm',
	mainFields: ['module', 'main'],
	banner: { js: 'import { createRequire as __nodeCreateRequire } from \'node:module\'; const require = __nodeCreateRequire(import.meta.url);' },
	external: ['better-sqlite3', 'sqlite3', 'libsql', '@libsql/client', 'mariadb', 'mysql', 'mysql2', 'pg', 'oracledb', 'tedious', 'tsdav'],
}

/** Frontend bundle — fully self-contained (no externals), code-split into `dist/`. */
export const frontendOptions: BuildOptions = {
	entryPoints: ['./src/frontend/index.ts'],
	bundle: true,
	splitting: true,
	format: 'esm',
	legalComments: 'none',
	outdir: distDir,
}

/** The single-page shell that boots the bundled frontend. */
export function writeIndexHtml() {
	fs.mkdirSync(distDir, { recursive: true })
	fs.writeFileSync(join(distDir, 'index.html'), `
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
}
