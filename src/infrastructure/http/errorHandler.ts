import { type ErrorRequestHandler } from 'express'
import { NotFoundError } from '@mikro-orm/sqlite'
import { createLogger } from '#infrastructure/logging/Logger.js'

const logger = createLogger('API')

/** Extracts HTTP error status (400-599) from Error object when present. */
function httpStatusOf(error: unknown) {
	const status = Number((error as { status?: unknown, statusCode?: unknown }).status ?? (error as { statusCode?: unknown }).statusCode)
	return Number.isInteger(status) && status >= 400 && status <= 599 ? status : undefined
}

// Central error handler. Many errors at once arrive as one AggregateError, whose first answers for the status and the message.
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
	const errors: Array<Error> | undefined = error instanceof AggregateError && error.errors.length ? error.errors : undefined
	const first = errors?.[0] ?? error
	const status = first instanceof NotFoundError ? 404 : (httpStatusOf(first) ?? 500)
	if (status >= 500) {
		logger.error(`${req.method} ${req.originalUrl} failed:`, error)
	} else {
		logger.debug(`${req.method} ${req.originalUrl} → ${status}: ${errors?.map(each => each.message).join('; ') ?? first.message}`)
	}
	res.status(status).json({ error: first.message, ...errors ? { errors } : {} })
}
