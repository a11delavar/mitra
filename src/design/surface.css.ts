import { unsafeCSS } from '@a11d/lit'

/** The glass's colour. A context tints every floating surface at once by setting `--mitra-surface`, as the entry editor does with its own colour. */
export const surfaceColor = unsafeCSS('var(--mitra-surface, color-mix(in srgb, var(--color-surface) 95%, transparent))')

/** The glass every floating surface wears. */
export const surface = unsafeCSS(`
	background: ${surfaceColor};
	backdrop-filter: blur(10px);
	border: var(--border);
	border-radius: 8px;
	box-shadow: 0 24px 48px -8px rgb(0 0 0 / 0.48), 0 4px 12px -1px rgb(0 0 0 / 0.24);
	color: var(--color-text);
`)
