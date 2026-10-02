import { css } from '@a11d/lit'
import { contrastColorOf } from '../../../design/contrastColor.js'

/**
 * The colors an entry's surfaces derive from `--mitra-entry-segment-color`. Whatever hosts an entry's editor declares
 * them, so the editor looks the same wherever it opens: without them its surface resolved to nothing but the blur.
 */
export const entryColors = css`
	--color-accent: var(--mitra-entry-segment-color);
	${contrastColorOf('--color-accent-text', 'var(--color-accent)')};
	--mitra-entry-surface: color-mix(in srgb, color-mix(in srgb, var(--mitra-entry-segment-color) 7.5%, var(--color-surface)) 80%, transparent);
	--mitra-surface: var(--mitra-entry-surface);
`
