import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** The one sanctioned reach outward: nested dialogs render in the dialog's shadow top layer and need the app's styles there. */
const exceptions = new Set(['Dialog.ts → ../app/Mitra.js'])

describe('the design library', () => {
	it('imports nothing from the app or its features', () => {
		const directory = join('src', 'design')
		const violations = readdirSync(directory, { recursive: true, encoding: 'utf8' })
			.filter(file => file.endsWith('.ts') && !file.endsWith('.test.ts'))
			.flatMap(file => [...readFileSync(join(directory, file), 'utf8').matchAll(/\bfrom\s+'([^']+)'|\bimport\s+'([^']+)'/g)]
				.map(match => match[1] ?? match[2]!)
				.filter(specifier => /(^|\/)(app|features|integrations|infrastructure)\//.test(specifier))
				.map(specifier => `${file.replaceAll('\\', '/')} → ${specifier}`))
			.filter(violation => !exceptions.has(violation))
		assert.deepEqual(violations, [])
	})
})
