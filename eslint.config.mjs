import configs from '@a11d/eslint-config/eslint.config.mjs'

export default [
	...configs,
	{
		ignores: ['dist', 'out', 'out_test'],
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
]
