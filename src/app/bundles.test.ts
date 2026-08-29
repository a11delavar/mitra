import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import esbuild from 'esbuild'
import { backendOptions, frontendOptions } from '../../scripts/esbuild.ts'

/**
 * Bundle graph invariants asserted against esbuild metafiles.
 */

const inputsOf = async (options: esbuild.BuildOptions) => {
	const result = await esbuild.build({ ...options, outfile: undefined, outdir: 'out_bundle_check', metafile: true, write: false, sourcemap: false })
	return Object.keys(result.metafile!.inputs)
}

describe('the server bundle', () => {
	it('registers the sync engines', async () => {
		const inputs = await inputsOf(backendOptions)
		assert.ok(
			inputs.some(input => input.includes('integrations/server/registerEngines')),
			'app/server.ts must (transitively) import integrations/server/registerEngines.js',
		)
	})

	it('carries no settings UI, so the domain can never reach for a preference', async () => {
		const inputs = await inputsOf(backendOptions)
		assert.ok(
			!inputs.some(input => input.includes('features/settings/client')),
			'the server bundle must not reach any settings client code',
		)
	})
})

describe('the browser bundle', () => {
	it('carries no sync engine, nor the protocol client only an engine talks to', async () => {
		const inputs = await inputsOf(frontendOptions)
		for (const forbidden of ['CalDAVSyncEngine', 'node_modules/tsdav', 'TempoSyncEngine', 'TempoClient', 'JiraClient']) {
			assert.ok(
				!inputs.some(input => input.includes(forbidden)),
				`${forbidden} must not reach the browser bundle`,
			)
		}
	})
})
