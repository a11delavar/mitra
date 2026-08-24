import configs from '@a11d/eslint-config/eslint.config.mjs'

export default [
	...configs,
	{
		// `website` is the standalone docs site (its own package and conventions), not app code.
		ignores: ['dist', 'out', 'out_test', 'website'],
	},
	{
		rules: {
			// The frontend has no logger; surfacing genuine problems via console.warn/error is fine.
			'no-console': ['error', { allow: ['warn', 'error'] }],
			// Allow underscore-prefixed unused args (e.g. Express's required 4-arg error handler).
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
			// Mitra intentionally rides modern web platform features (popover, customizable <select>,
			// anchor positioning, Temporal). Don't gate the templates on Baseline availability.
			'@html-eslint/use-baseline': 'off',
			'@stylistic/js/eol-last': ['error', 'always']
		},
	},
	{
		// Build/dev tooling logs progress to the console by design.
		files: ['scripts/**'],
		rules: {
			'no-console': 'off',
		},
	},
	{
		files: ['src/**/client/**', 'src/design/**', 'src/app/client.ts', 'src/app/Mitra.ts', 'src/app/Sidebar.ts'],
		rules: {
			'no-restricted-imports': ['error', {
				patterns: [{
					group: ['**/server/**', '*/server/*'],
					message: 'Client code must not import server code.'
				}]
			}]
		}
	},
	{
		files: ['src/**/server/**', 'src/app/server.ts'],
		rules: {
			'no-restricted-imports': ['error', {
				patterns: [{
					group: ['**/client/**', '*/client/*'],
					message: 'Server code must not import client code.'
				}]
			}]
		}
	},
	{
		files: ['src/features/*/*.ts', 'src/integrations/*.ts'],
		ignores: ['src/features/*/*.test.ts', 'src/integrations/*.test.ts'],
		rules: {
			'no-restricted-imports': ['error', {
				patterns: [{
					group: ['**/client/**', '*/client/*', '**/server/**', '*/server/*'],
					message: 'Isomorphic domain models must not import client or server code.'
				}]
			}]
		}
	}
]
