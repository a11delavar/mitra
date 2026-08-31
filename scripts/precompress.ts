import fs from 'node:fs/promises'
import path from 'node:path'
import zlib from 'node:zlib'
import { promisify } from 'node:util'
import { distDir } from './esbuild.ts'
import { PRECOMPRESSABLE } from '../src/infrastructure/http/compression.ts'

const gzip = promisify(zlib.gzip)
const brotli = promisify(zlib.brotliCompress)

const MIN_BYTES = 1024

/**
 * Precompresses static build assets in dist/ using Brotli 11 and Gzip 9.
 */
export async function precompress(directory = distDir) {
	const entries = await fs.readdir(directory, { recursive: true, withFileTypes: true })
	const files = entries.filter(entry => entry.isFile() && path.extname(entry.name).toLowerCase() in PRECOMPRESSABLE).map(entry => path.join(entry.parentPath, entry.name))

	const results = await Promise.all(files.map(async file => {
		const source = await fs.readFile(file)
		if (source.length < MIN_BYTES) {
			return { file, saved: 0 }
		}
		const [br, gz] = await Promise.all([
			brotli(source, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: source.length } }),
			gzip(source, { level: 9 }),
		])
		await Promise.all([
			br.length < source.length ? fs.writeFile(`${file}.br`, br) : fs.rm(`${file}.br`, { force: true }),
			gz.length < source.length ? fs.writeFile(`${file}.gz`, gz) : fs.rm(`${file}.gz`, { force: true }),
		])
		return { file, source: source.length, br: br.length, gz: gz.length, saved: source.length - br.length }
	}))

	const total = (key: 'source' | 'br') => results.reduce((sum, result) => sum + (result[key] ?? 0), 0)
	return { files: results.filter(result => result.saved > 0).length, raw: total('source'), brotli: total('br') }
}
