import { type RequestHandler } from 'express'

/**
 * The instance's public origin, needed wherever mitra hands its own URL to somebody else (an
 * `ATTACH` line, a provider's file field). `MITRA_URL` is authoritative when set; otherwise the
 * address the last request arrived at stands in, which is what a localhost or LAN instance has.
 */
let observed: string | undefined

function configured(): string | undefined {
	const url = process.env.MITRA_URL?.trim()
	if (!url) {
		return undefined
	}
	try {
		return new URL(url).origin
	} catch {
		return undefined
	}
}

export function instanceOrigin(): string | undefined {
	return configured() ?? observed
}

/** Remembers the address requests arrive at, so background writes can still build absolute URLs. */
export const observeInstanceOrigin: RequestHandler = (req, _res, next) => {
	const host = req.get('x-forwarded-host')?.split(',')[0]?.trim() || req.get('host')
	const protocol = req.get('x-forwarded-proto')?.split(',')[0]?.trim() || req.protocol
	if (host && protocol) {
		observed = `${protocol}://${host}`
	}
	next()
}

/** Test seam — production only ever learns the origin from a real request. */
export function setObservedOrigin(origin: string | undefined) {
	observed = origin
}
