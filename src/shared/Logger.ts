import { consola } from 'consola'

export const logger = consola.create({
	defaults: {
		tag: 'App',
	},
})

export function createLogger(tag: string) {
	return logger.withTag(tag)
}
