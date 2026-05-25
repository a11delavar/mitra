import { spawn } from 'child_process'
import * as esbuild from 'esbuild'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const tsgoPlatformDir = dirname(fileURLToPath(import.meta.resolve(`@typescript/native-preview-${process.platform}-${process.arch}/package.json`)))
spawn(join(tsgoPlatformDir, `lib/tsgo${process.platform === 'win32' ? '.exe' : ''}`), ['--noEmit', '--watch'], { stdio: 'inherit' })

// Spawn the backend server using tsx so it supports decorators and tsconfig paths natively
spawn('npx', ['tsx', 'watch', 'src/backend/server.ts'], { stdio: 'inherit', shell: true })

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