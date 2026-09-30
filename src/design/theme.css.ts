import { css } from '@a11d/lit'
import { contrastColorOf } from './contrastColor.js'

/** The palette every surface derives from. The website emits this block verbatim, so it holds no app behaviour. */
export const themeStyles = css`
	:root {
		color-scheme: light dark;
		--color-background-seed: color-mix(in srgb, light-dark(#f1f3f4, #121314), var(--color-accent) 2.5%);
		--color-background: var(--color-background-seed);
		--color-surface: color-mix(in srgb, light-dark(#ffffff, #191a1b), var(--color-accent) 5%);
		--color-text: color-mix(in srgb, light-dark(black, white), var(--color-accent) 2.5%);
		--color-text-muted: color-mix(in srgb, var(--color-text), var(--color-background) 45%);
		--color-error: light-dark(#d1453b, #e5675e);
		--color-accent: light-dark(black, white);
		${contrastColorOf('--color-accent-text', 'var(--color-accent)')};
		--color-border: var(--color-surface);
		--border: 1px solid var(--color-border);
		--border-radius: 4px;
		--font-family: 'Inter Variable', 'Vazirmatn Variable', sans-serif;

		&[data-theme=light] {
			color-scheme: light;
		}

		&[data-theme=dark] {
			color-scheme: dark;
		}
	}
`
