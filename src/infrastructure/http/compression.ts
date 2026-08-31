import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import compressionMiddleware from 'compression'
import type { RequestHandler, Response } from 'express'

const MIN_BYTES = 1024
const BROTLI_QUALITY = 5

const ENCODINGS = [['br', '.br'], ['gzip', '.gz']] as const

function negotiate(header: string | undefined) {
	const accepted = (header ?? '').toLowerCase()
	return ENCODINGS.find(([token]) => accepted.includes(token))
}

/** Appends Accept-Encoding to Vary response header. */
function vary(res: Response) {
	const announced = String(res.getHeader('Vary') ?? '').split(',').map(value => value.trim()).filter(Boolean)
	res.setHeader('Vary', [...new Set([...announced, 'Accept-Encoding'])].join(', '))
}

/**
 * Dynamic response compression middleware (1 KB threshold, brotli 5).
 * Explicitly excludes text/event-stream to prevent buffering SSE streams.
 */
export function compression(): RequestHandler {
	return compressionMiddleware({
		threshold: MIN_BYTES,
		brotli: { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY } },
		filter: (req, res) => !String(res.getHeader('Content-Type') ?? '').startsWith('text/event-stream') && compressionMiddleware.filter(req, res),
	})
}

/** Content-Type mapping for precompressed static asset extensions. */
export const PRECOMPRESSABLE: Record<string, string> = {
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.html': 'text/html; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.map': 'application/json; charset=utf-8',
	'.webmanifest': 'application/manifest+json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.xml': 'application/xml',
	'.txt': 'text/plain; charset=utf-8',
}

/**
 * Middleware serving precompressed (.br/.gz) static assets when available and fresh.
 */
export function precompressed(root: string): RequestHandler {
	return (req, res, next) => {
		if (req.method !== 'GET' && req.method !== 'HEAD') {
			return next()
		}
		vary(res)
		const negotiated = negotiate(req.headers['accept-encoding'] as string | undefined)
		const pathname = req.url?.split(/[?#]/)[0] ?? ''
		const type = PRECOMPRESSABLE[path.extname(pathname).toLowerCase()]
		if (!negotiated || !type) {
			return next()
		}
		const [encoding, extension] = negotiated
		const file = resolve(root, pathname)
		if (!file || !fresh(file, file + extension)) {
			return next()
		}
		res.setHeader('Content-Encoding', encoding)
		res.setHeader('Content-Type', type)
		req.url = `${pathname}${extension}${req.url!.slice(pathname.length)}`
		return next()
	}
}

/** The requested file inside `root`, or undefined if the path is malformed or escapes it. */
function resolve(root: string, requested: string) {
	try {
		const file = path.join(root, path.normalize(decodeURIComponent(requested)))
		return file.startsWith(root) ? file : undefined
	} catch {
		return undefined
	}
}

/** Checks if precompressed sibling exists and is newer than source file. */
function fresh(source: string, sibling: string) {
	try {
		return fs.statSync(sibling).mtimeMs >= fs.statSync(source).mtimeMs
	} catch {
		return false
	}
}
