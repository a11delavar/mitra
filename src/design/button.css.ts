import { css } from '@a11d/lit'
import { focusRing } from './focusRing.css.js'
import { activated } from './activated.css.js'
import { controlHeight } from './controlHeight.css.js'

/**
 * A standalone button's chrome. Like input.css.ts, it stands down for a button that IS an editor field
 * or lives inside one: there the FIELD owns every surface and state (field.css.ts), and a button that
 * merely stands in for the real control — the date row's "+ End date" — has to be indistinguishable
 * from the field beside it. `all: unset` on such a button is NOT enough to opt out, because these state
 * rules outweigh it; the guard is what actually keeps them off (which is why that button used to take a
 * hover background and lose the field's corner radius). Nested dialogs are their own surface, so their
 * buttons keep the standalone chrome.
 */
export const buttonStyles = css`
	:is(button, select):where(:not(.field, .field *), dialog *) {
		appearance: base-select;
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		${controlHeight};
		height: var(--control-height);
		font-family: inherit;
		font-size: 0.8125rem;
		font-weight: 500;
		background: color-mix(in srgb, var(--color-text) 5%, transparent);
		color: var(--color-text);
		border: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent);
		border-radius: var(--border-radius);
		padding: 0.375rem 0.75rem;
		cursor: pointer;
		transition: all 0.3s cubic-bezier(0.1, 0.9, 0.2, 1);

		&:not(:disabled) {
			&:hover {
				${activated};
			}

			&:active {
				background: color-mix(in srgb, var(--color-text) 14%, transparent);
				box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-text) 2%, transparent);
				transition-duration: 0.05s;
			}
		}

		${focusRing};

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	}
`
