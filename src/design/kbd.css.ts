import { css } from '@a11d/lit'

/**
 * A keyboard hint: the key chip (`<kbd>`) and the gesture word that may follow it — "Alt drag". ONE
 * definition for every hint in the app (menu items, the command palette's rows, the header's chips,
 * the keyboard cheat sheet), so a hint looks and behaves the same wherever it appears.
 *
 * Hints are HIDDEN on a coarse pointer. A device driven by a finger has no keys to press, so a chip
 * reading "Del" is noise — and a gesture word left dangling beside a hidden chip ("Duplicate drag")
 * is worse, which is why the word goes with it. The keyboard cheat sheet re-declares `display` on
 * both and so opts itself back in: there the keys ARE the content, not decoration.
 *
 * NB this is about the INPUT DEVICE, not the window size — a small desktop window still has a
 * keyboard. The header separately drops hints when it runs out of room (a container query in
 * PageCalendar); the two are orthogonal.
 */
export const kbdStyles = css`
	kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-family: inherit;
		font-size: 0.6rem;
		font-weight: 600;
		color: color-mix(in srgb, var(--color-text) 45%, transparent);
		background: color-mix(in srgb, var(--color-text) 4%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent);
		border-radius: 4px;
		padding: 0.125rem 0.25rem;
		pointer-events: none;
	}

	/* A gesture beside the chip ("drag") — a word, not a key, so it wears no pill. */
	.word {
		font-size: 0.6875rem;
		color: var(--color-text-muted);
	}

	@media (pointer: coarse) {
		:is(kbd, .word) {
			display: none;
		}
	}
`
