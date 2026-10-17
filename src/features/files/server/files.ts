import { Router } from 'express'
import { type EntityClass } from '@mikro-orm/core'
import { orm } from '../../../infrastructure/database/orm.js'
import { createLogger } from '../../../infrastructure/logging/Logger.js'
import { File } from '../File.js'
import { MimeType } from '../MimeType.js'
import { FileTooLargeError, fileStore } from './FileStore.js'
import { FileLimits } from './FileLimits.js'

const logger = createLogger('Files')

/**
 * Serves the files Mitra holds, whichever of the file `tables` carries one. Unauthenticated by design: the 128-bit id in the path
 * is the capability, so the URL also works from the calendar servers and the other clients reading those calendars, none of
 * which carry a Mitra session.
 */
export function fileContentRouter(tables: ReadonlyArray<EntityClass<File>>) {
	const router = Router()
	router.get('/:id{/:name}', async (req, res) => {
		const em = orm.em.fork()
		let file: File | null = null
		for (const table of tables) {
			file ??= await em.findOne<File>(table, { id: req.params.id, sha256: { $ne: null } })
		}
		const size = file?.userId ? await fileStore.sizeOf(file.userId, file.sha256!) : undefined
		if (!file || size === undefined) {
			return res.status(404).json({ error: 'File not found' })
		}

		res.setHeader('Content-Type', String(file.mimeType ?? MimeType.octetStream))
		res.setHeader('X-Content-Type-Options', 'nosniff')
		res.setHeader('Content-Disposition', file.disposition)
		// A file shown in place must never be able to script the app's own origin.
		res.setHeader('Content-Security-Policy', 'sandbox')
		res.setHeader('Referrer-Policy', 'no-referrer')
		res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
		// `no-transform` keeps the compression middleware off: gzip would break byte ranges and the ETag.
		res.setHeader('Cache-Control', 'private, max-age=31536000, immutable, no-transform')
		res.setHeader('ETag', `"${file.sha256}"`)
		res.setHeader('Accept-Ranges', 'bytes')

		if (req.headers['if-none-match']?.includes(file.sha256!)) {
			return res.status(304).end()
		}

		const range = rangeOf(req.headers.range, size)
		if (range === 'unsatisfiable') {
			res.setHeader('Content-Range', `bytes */${size}`)
			return res.status(416).end()
		}
		if (range) {
			res.status(206)
			res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${size}`)
			res.setHeader('Content-Length', String(range.end - range.start + 1))
		} else {
			res.setHeader('Content-Length', String(size))
		}

		if (req.method === 'HEAD') {
			return res.end()
		}
		return fileStore.read(file.userId!, file.sha256!, range || undefined).pipe(res)
	})
	return router
}

/** A single-range `Range` header; several ranges and malformed values fall back to the whole body. */
function rangeOf(header: string | undefined, size: number): { start: number, end: number } | undefined | 'unsatisfiable' {
	const match = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() ?? '')
	if (!match || (!match[1] && !match[2])) {
		return undefined
	}
	const [start, end] = !match[1]
		? [Math.max(0, size - Number(match[2])), size - 1]
		: [Number(match[1]), match[2] ? Math.min(Number(match[2]), size - 1) : size - 1]
	return start > end || start >= size ? 'unsatisfiable' : { start, end }
}

/** Receives uploads: the body is the file itself, its type and name on the standard headers, as RFC 8607 has them. */
export const filesRouter = Router()

filesRouter.post('/', async (req, res) => {
	const limits = FileLimits.fromEnv()
	if (!limits.uploads) {
		return res.status(403).json({ error: 'Uploads are disabled on this instance' })
	}
	if (!limits.allowsMore(await fileStore.usageOf(req.user.id))) {
		return res.status(507).json({ error: 'File storage is full' })
	}

	const name = File.nameFrom(req.get('content-disposition'))
	const mimeType = MimeType.parse(req.get('content-type')) ?? MimeType.octetStream

	const bytes = await fileStore.put(req.user.id, req, limits.maxSize).catch((error: unknown) => {
		if (error instanceof FileTooLargeError) {
			return error
		}
		throw error
	})
	if (bytes instanceof FileTooLargeError) {
		return res.status(413).json({ error: `This file is larger than the ${Math.round(limits.maxSize / 1024 / 1024)} MB limit` })
	}
	if (!bytes.size) {
		await fileStore.delete(req.user.id, bytes.sha256)
		return res.status(400).json({ error: 'The file is empty' })
	}

	logger.debug(`Stored ${bytes.size} bytes (${mimeType}) for user ${req.user.id}`)
	// A reference by its bytes: the entry's save gives it a row, and the row its id (FileStore.claim).
	return res.status(201).json({ sha256: bytes.sha256, size: bytes.size, name, mimeType: String(mimeType) })
})
