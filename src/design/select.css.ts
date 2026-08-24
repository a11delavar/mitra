import { css } from '@a11d/lit'
import { focusRing } from './focusRing.css.js'
import { pickerRow, pickerRowChosen } from './pickerRow.css.js'

export const selectStyles = css`
	::picker(select) {
		appearance: base-select;

		/* A picker opened inside a bottom SHEET flips above its button and can be clamped to a scrolling
		   sliver — the same known gap the menus have, from the same cause and with the same fix pending;
		   the debugging and the measurements live in menu.css.ts. */
		background: color-mix(in srgb, color-mix(in srgb, var(--color-background) 80%, var(--color-surface)) 95%, transparent);
		backdrop-filter: blur(10px);
		border: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent);
		border-radius: 8px;
		padding: 0.375rem;
		box-shadow:
			0 4px 16px rgba(0, 0, 0, 0.2),
			0 16px 48px rgba(0, 0, 0, 0.2);
		color: var(--color-text);
		min-width: 150px;
	}

	select {
		/* Opting into the customizable select is UNCONDITIONAL and belongs here, not with the standalone
		   button chrome: without it the whole file below is dead — no <selectedcontent>, no ::picker(),
		   no ::picker-icon, just the platform's native listbox. (It used to ride along in button.css, so
		   the moment that stood down for selects inside a field, every select in the editor reverted to
		   native.) */
		appearance: base-select;

		&::picker-icon {
			content: "";
			display: block;
			width: 1.125rem;
			height: 1.125rem;
			background-color: color-mix(in srgb, var(--color-text) 60%, transparent);
			-webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
			-webkit-mask-size: contain;
			-webkit-mask-position: center;
			-webkit-mask-repeat: no-repeat;
			mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
			mask-size: contain;
			mask-position: center;
			mask-repeat: no-repeat;
			transition: rotate 0.3s cubic-bezier(0.1, 0.9, 0.2, 1);
		}

		${focusRing};

		&:is(:open, :popover-open)::picker-icon {
			rotate: 180deg;
		}

		& > button {
			display: contents;
			& > selectedcontent {
				kbd {
					display: none;
				}
			}
		}

		/* A DESCENDANT selector, deliberately: the source picker groups its options in <optgroup>s, and a
		   direct-child rule left every grouped option completely unstyled — UA padding, the UA's own two-tone
		   focus ring, and no tick. The row itself is the shared one (pickerRow.css.ts), so an option and a
		   time-zone row are the same row; only what a select adds on top lives here. */
		& option {
			appearance: base-select;
			${pickerRow};
			justify-content: space-between;

			&:checked {
				${pickerRowChosen};
			}

			&::checkmark {
				display: none;
			}
		}
	}
`
