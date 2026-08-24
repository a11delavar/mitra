import { Api } from '@a11d/api'
import { ModelValueConstructor } from '@a11d/api-model-value-constructor'

/**
 * Test support for the API boundary, so each model can assert its own wire shape in its own test file
 * instead of a separate suite duplicating them all. Not production code — nothing imports it but tests.
 */

/** The request body `@a11d/api` builds for `value`: deconstructed, `@type`-tagged, and structure-cloned
 * (which strips every prototype, the harshest thing a model crosses). */
export function wireOf(value: unknown): any {
	return JSON.parse(JSON.stringify((Api as unknown as { handleRequest(data: unknown): unknown }).handleRequest(value)))
}

/** That body as the server's reviver parses it — see the `express.json` reviver in app/server.ts. */
export function revive<T>(body: unknown): T {
	const constructor = new ModelValueConstructor
	return JSON.parse(JSON.stringify(body), (_key, value) => constructor.shallConstruct(value) ? constructor.construct(value) : value) as T
}

/**
 * Takes the BROWSER's end of the wire for the duration of `action` — the test bundle is built as the
 * server (see `runtime` in scripts/esbuild.ts), and a request is the direction where a secret must
 * still travel.
 *
 * `mitra` is a build-time constant, declared readonly because nothing at run time has any business
 * changing what a bundle was built as. A test is the exception, and the cast is the admission: what
 * esbuild emits for the define is a plain object, so its fields are writable in practice.
 */
export function asBrowser<T>(action: () => T): T {
	const runtime = mitra as { runtime: string }
	runtime.runtime = 'browser'
	try {
		return action()
	} finally {
		runtime.runtime = 'server'
	}
}
