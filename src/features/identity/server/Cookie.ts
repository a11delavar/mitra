import type { CookieOptions, Request, Response } from 'express'

/** A cookie the server sets and reads back by its name, always with the same options. */
export class Cookie {
	constructor(readonly name: string, private readonly options: CookieOptions = {}) { }

	/** Its value in the request's Cookie header, if it carries one. */
	readIn(req: Request) {
		for (const pair of req.headers.cookie?.split(';') ?? []) {
			const separator = pair.indexOf('=')
			if (pair.slice(0, separator).trim() === this.name) {
				return decodeURIComponent(pair.slice(separator + 1).trim())
			}
		}
		return undefined
	}

	write(res: Response, value: string) {
		res.cookie(this.name, value, this.options)
	}

	clear(res: Response) {
		res.clearCookie(this.name, { path: this.options.path ?? '/' })
	}
}
