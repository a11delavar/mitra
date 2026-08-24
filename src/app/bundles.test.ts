import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import esbuild from 'esbuild'
import { backendOptions, frontendOptions } from '../../scripts/esbuild.ts'

/**
 * Invariants about what each composition root actually pulls in — asserted against esbuild's real
 * module graph, because both of these are decided by a single import line that type-checks either way.
 *
 * Neither is reachable from a normal unit test: the wiring lives in app/server.ts and app/client.ts,
 * and the thing that goes wrong is a module being absent, which no amount of exercising the code that
 * needs it can detect once it is gone.
 */

const inputsOf = async (options: esbuild.BuildOptions) => {
	// `write: false` keeps this off disk; the metafile is the whole point of the build.
	const result = await esbuild.build({ ...options, outfile: undefined, outdir: 'out_bundle_check', metafile: true, write: false, sourcemap: false })
	return Object.keys(result.metafile!.inputs)
}

describe('the server bundle', () => {
	it('registers the sync engines', async () => {
		// Sync engines are registered as an IMPORT SIDE EFFECT (see integrations/Integration.ts), so the
		// single `import '../integrations/server/registerEngines.js'` in server.ts is load-bearing:
		// without it every CalDAV/Google/Apple sync and every entry write to one throws at run time,
		// in production, while the whole test suite still passes. Nothing else can catch its removal.
		const inputs = await inputsOf(backendOptions)
		assert.ok(
			inputs.some(input => input.includes('integrations/server/registerEngines')),
			'app/server.ts must (transitively) import integrations/server/registerEngines.js',
		)
	})
})

describe('the browser bundle', () => {
	// The reason the CalDAV sync engine is a separate server-side collaborator rather than methods on
	// the CalDAV class: that class is also the frontend's API model, so anything it imports is shipped
	// to every visitor. One convenient import back onto it would silently undo the split — the app
	// would still work, just heavier, which is precisely the kind of regression nobody notices.
	it('carries no sync engine, nor the protocol client only an engine talks to', async () => {
		const inputs = await inputsOf(frontendOptions)
		for (const forbidden of ['CalDAVSyncEngine', 'node_modules/tsdav']) {
			assert.ok(
				!inputs.some(input => input.includes(forbidden)),
				`${forbidden} must not reach the browser bundle`,
			)
		}

		// Deliberately NOT asserted, so this test says only what is true today: `ical.js` is still here,
		// because CalDAV's iCalendar↔Entry mapping statics stayed on the class the frontend models, and
		// `@mikro-orm/core` because infrastructure/model/orm.ts re-exports Collection/Type at run time.
		// Both are real weight the split has not yet reclaimed — adding them here is the finish line.
	})
})
