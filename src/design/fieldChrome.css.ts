import { unsafeCSS } from '@a11d/lit'

/**
 * A field's box, for the element that carries it (an input, a segmented box, a select's button): a quiet tint and
 * hairline, deeper on hover, and the focus ring. A context that wears the box itself strips it through `--mitra-field-*`,
 * the ring included (`--mitra-field-ring`): it draws its own around the whole context.
 */
export const fieldChrome = unsafeCSS(`
	box-sizing: border-box;
	min-block-size: var(--control-height);
	border: 1px solid var(--mitra-field-border, color-mix(in srgb, var(--color-text) 8%, transparent));
	border-radius: 6px;
	background: var(--mitra-field-background, color-mix(in srgb, var(--color-text) 5%, transparent));
	outline: none;
	transition: background 0.3s cubic-bezier(0.1, 0.9, 0.2, 1), border-color 0.15s ease, box-shadow 0.15s ease;

	&:hover {
		background: var(--mitra-field-background, color-mix(in srgb, var(--color-text) 8%, transparent));
	}

	&:is(:focus-visible, :has(:focus-visible)) {
		outline: none;
		border-color: var(--mitra-field-ring, var(--focus-ring-color, transparent));
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--mitra-field-ring, var(--focus-ring-color, transparent)) 45%, transparent);
	}
`)

/** For an overlay opened from a context that wears the box itself (a dialog, a picker): its own fields get their chrome back. */
export const fieldChromeRestored = unsafeCSS(`
	--mitra-field-border: initial;
	--mitra-field-background: initial;
	--mitra-field-padding: initial;
	--mitra-field-button: initial;
	--mitra-field-readonly-opacity: initial;
	--mitra-field-ring: initial;
	--mitra-select-indicator-opacity: initial;
`)
