import { unsafeCSS } from '@a11d/lit'

/**
 * `--scrollbar-width` is its lane, for a layout that reserves it with `scrollbar-gutter`. Chromium ignores
 * `::-webkit-scrollbar` once `scrollbar-width` is set, so the standard properties are only Firefox's.
 */
export const scrollbar = unsafeCSS`
	--scrollbar-width: 0.375rem;

	/* scrollbar-color is inherited, and one from an ancestor (the settings dialog's) would switch the thumb below off. */
	@supports selector(::-webkit-scrollbar-thumb) {
		scrollbar-color: auto;
		scrollbar-width: auto;
	}

	&::-webkit-scrollbar {
		inline-size: var(--scrollbar-width);
		block-size: var(--scrollbar-width);
	}

	&::-webkit-scrollbar-track, &::-webkit-scrollbar-corner {
		background: transparent;
	}

	&::-webkit-scrollbar-button {
		display: none;
	}

	&::-webkit-scrollbar-thumb {
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-text) 12%, transparent);
	}

	&:hover::-webkit-scrollbar-thumb {
		background: color-mix(in srgb, var(--color-text) 26%, transparent);
	}

	@supports not selector(::-webkit-scrollbar-thumb) {
		scrollbar-width: thin;
		scrollbar-color: color-mix(in srgb, var(--color-text) 12%, transparent) transparent;
	}
`
