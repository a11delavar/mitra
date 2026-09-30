import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import esbuild from 'esbuild'
import { backendOptions, frontendOptions, serviceWorkerOptions } from '../../scripts/esbuild.ts'

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

describe('the service worker bundle', () => {
	it('stays dependency-free, so a push can be shown without dragging the app in', async () => {
		const inputs = await inputsOf(serviceWorkerOptions)
		assert.deepEqual(inputs.filter(input => input.includes('node_modules')), [])
	})

	it('renders no text itself: the server sends each device its notification', async () => {
		const inputs = await inputsOf(serviceWorkerOptions)
		assert.deepEqual(inputs.filter(input => input.includes('infrastructure/i18n') || input.includes('ReminderNotification')), [])
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

	it('takes the headless controllers', async () => {
		const inputs = await inputsOf(frontendOptions)
		for (const required of [
			'@3mo/menu/dist/controller.js',
			'@3mo/selection-group/dist/SelectionGroupController.js',
			'@3mo/list/dist/controller.js',
			'@3mo/date-time-fields/dist/controller.js',
			'@3mo/sheet/dist/SheetController.js',
		]) {
			assert.ok(inputs.some(input => input.includes(required)), `the design library runs on ${required}`)
		}
		// The list's controllers (`ListboxController`, `ComboboxController`) share the `List` prefix with its elements.
		for (const forbidden of ['@material/', '@3mo/list/dist/index.js', '@3mo/list/dist/List.js', '@3mo/list/dist/ListItem', '@3mo/menu/dist/Menu.js', '@3mo/menu/dist/index.js', '@3mo/date-time-fields/dist/index.js', '@3mo/field/', '@3mo/sheet/dist/Sheet.js', '@3mo/sheet/dist/index.js']) {
			assert.ok(!inputs.some(input => input.includes(forbidden)), `${forbidden} must not reach the browser bundle`)
		}
	})

	it('takes the data grid controller alone, never the Material components packaged around it', async () => {
		const inputs = await inputsOf(frontendOptions)
		assert.ok(
			inputs.some(input => input.includes('@3mo/data-grid/dist/controller/DataGridController.js')),
			'the table view runs on the data grid controller',
		)
		for (const forbidden of ['@3mo/data-grid/dist/index.js', '@3mo/data-grid/dist/DataGrid.js', '@3mo/data-grid/dist/columns/', '@3mo/theme', '@3mo/icon/', '@3mo/checkbox', '@3mo/menu/dist/Menu.js', '@3mo/popover', '@3mo/tooltip']) {
			assert.ok(
				!inputs.some(input => input.includes(forbidden)),
				`${forbidden} must not reach the browser bundle`,
			)
		}
	})
})
