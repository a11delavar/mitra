import { css, unsafeCSS } from '@a11d/lit'
import { ring } from '../../../design/focusRing.css.js'
import { activated } from '../../../design/activated.css.js'
import { controlHeight } from '../../../design/controlHeight.css.js'

/**
 * The entry editor's rows (`.field`): borderless until hovered, lit while one of their controls is in use, the focus
 * ring on the row. The design library's fields inside drop their own box through `--mitra-field-*`, and a row's
 * pickers hang from the whole row. Scoped by a weightless `:where()`, so every rule weighs what it did unscoped.
 */
// The shadow-rooted fields whose chrome a row wears, inside it or the row itself; their keyboard focus is the row's,
// read through `:state()`.
const focusedField = unsafeCSS(':is(mitra-select, mitra-date-field, mitra-time-field, mitra-date-time-field, mitra-duration-field, mitra-text-field, mitra-search-field, mitra-number-field):state(focus-visible)')

export const editorFieldStyles = css`
	:where(mitra-entry-details) {
		.field {
			box-sizing: border-box;
			appearance: none;
			font: inherit;
			color: inherit;
			text-align: start;
			${controlHeight};
			min-height: var(--control-height);
			--field-padding-inline: 0.5rem;
			line-height: 1.4;
			background: transparent;
			border: 1px solid transparent;
			border-radius: 6px;
			padding-inline: calc(var(--field-padding-inline) - 1px);
			transition: border-color 0.15s ease, background-color 0.15s ease;

			anchor-name: --field;
			anchor-scope: --field;

			/* The shadow-rooted fields inside (a date, a time) leave the chrome and the picker button to the row. */
			--mitra-field-border: transparent;
			--mitra-field-background: transparent;
			--mitra-field-padding: 0;
			--mitra-field-button: none;
			--mitra-field-readonly-opacity: 1;
			--mitra-field-ring: transparent;
			--mitra-select-indicator-opacity: 0;

			align-items: stretch;
			> mitra-icon {
				align-self: start;
				margin-block-start: calc((var(--control-height) - 2px) / 2 - 0.5em);
			}

			&:where(:hover) {
				border-color: color-mix(in srgb, var(--color-text) 15%, transparent);
			}

			&:where(
				:is(input, textarea, :has(:is(input:not([type=checkbox], [type=radio]), textarea))):focus-within,
				:is(mitra-date-field, mitra-time-field, mitra-date-time-field, mitra-duration-field, :has(mitra-date-field, mitra-time-field, mitra-date-time-field, mitra-duration-field)):focus-within,
				:open, :has(input:open, :popover-open, mitra-select[open]),
				:focus-visible, ${focusedField}, :has(:focus-visible, ${focusedField})
			) {
				${activated};
				border-color: transparent;
			}

			/* Preserves checkbox/radio boxes inside fields (e.g. description task lists). */
			:is(input:not([type=checkbox], [type=radio]), textarea):not(dialog *, mitra-dialog *) {
				appearance: none;
				box-sizing: border-box;
				min-inline-size: 0;
				max-inline-size: 100%;
				height: auto;
				background: transparent;
				border: none;
				border-radius: 0;
				padding: 0;
				font: inherit;
				color: inherit;
				box-shadow: none;
				outline: none;

				&:is(:hover, :active, :focus, :focus-visible) {
					background: transparent;
					box-shadow: none;
					outline: none;
				}

				&:is(textarea) {
					padding-block: calc((var(--control-height) - 2px - 1lh) / 2);
				}
			}

			&:is(:hover, :focus-within) {
				--mitra-select-indicator-opacity: 1;
			}

			/* The ring is the row's, also for a shadow-rooted field inside, whose own ring gives way (--mitra-field-ring). */
			&:is(:focus-visible, ${focusedField}, :has(:focus-visible, ${focusedField})) {
				${ring};
			}

			/* A picker hanging from the row takes the ring's place; suggestions under the row's own input do not. */
			&:has([popover]:popover-open:not(mitra-listbox)) {
				border-color: transparent;
				box-shadow: none;
			}
		}

		/* A field's pickers hang from the whole field rather than the control that opened them. Weightless, so a picker may
		   anchor elsewhere. A dialog opened from a row is not part of it: its own pickers hang from their controls. */
		:where(.field [popover]:not(dialog *, mitra-dialog *)),
		:where(.field mitra-select:not(dialog *, mitra-dialog *))::part(listbox) {
			position-anchor: --field;
		}

		/* A row's own input or text: the row draws the ring, and a description grows with its lines. */
		:is(input, textarea).field {
			outline: none;
		}

		:is(.field textarea, textarea.field) {
			field-sizing: content;
			resize: none;
			line-height: 1.4;
		}

		/* A shadow-rooted field inside a row reads in the row's own type, as the native inputs it replaced did. */
		.field :is(mitra-date-field, mitra-time-field, mitra-date-time-field, mitra-duration-field, mitra-select),
		:is(mitra-date-field, mitra-time-field, mitra-date-time-field, mitra-duration-field, mitra-select).field {
			font: inherit;
		}

		/* A select fills its row, its chevron at the row's end. */
		.field mitra-select {
			display: flex;
		}

		.field {
			::placeholder,
			.placeholder,
			&:is([data-placeholder], :has([data-placeholder])) .text,
			[data-placeholder] {
				color: var(--color-text-muted);
				opacity: 1;
				font-weight: 400;
			}
		}
	}
`
