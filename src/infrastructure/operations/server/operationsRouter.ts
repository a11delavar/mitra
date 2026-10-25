import type { EntityManager } from '@mikro-orm/sqlite'
import { Router } from 'express'
import { http, operation, type HttpFacts } from '../Operation.js'

/** Where a path's segments are parameters (`/entries/:id` is `[0, 0, 1]`), so a fixed one sorts before a parameter in its place. */
const shapeOf = (path: string) => path.split('/').map(segment => segment.startsWith(':') ? 1 : 0)

/** Lexical, so `/entries/ranks` matches before `/entries/:id` whichever module registered first. */
const bySpecificity = (a: HttpFacts, b: HttpFacts) => {
	const [first, second] = [shapeOf(a.path), shapeOf(b.path)]
	const differing = first.findIndex((each, index) => each !== second[index])
	return differing === -1 ? first.length - second.length : first[differing]! - (second[differing] ?? -1)
}

/** Mounts every operation's route after the feature routers, whose own paths come before an operation's `:id`, a fixed segment before a parameter in its place. */
export function operationsRouter(em: () => EntityManager) {
	const router = Router()
	const routed = operation.all().flatMap(each => {
		const facts = http.get(each)
		return facts && each.fromRequest ? [{ each, facts }] : []
	})
	for (const { each, facts } of routed.sort((a, b) => bySpecificity(a.facts, b.facts))) {
		router[facts.method.toLowerCase() as Lowercase<HttpFacts['method']>](facts.path, async (req, res) => {
			const result = await each.fromRequest!(req).run({ em: em(), user: req.user })
			return result === undefined ? res.status(facts.status ?? 204).end() : res.status(facts.status ?? 200).json(result)
		})
	}
	return router
}
