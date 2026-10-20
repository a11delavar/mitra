import { Component, component, html, css, property } from '@a11d/lit'
import { controlHeight, ring } from '#design'
import { type Setting } from './Setting.js'
import { SettingsStore } from './SettingsStore.js'

/**
 * A setting as a card: leading glyph, label with optional hint, and trailing control, its details below on the same
 * columns. A list in the details (`ul`) lays its items as rows like the card's own, so a list needs no layout of its own.
 */
@component('mitra-setting-row')
export class SettingRow extends Component {
	@property({ type: Object }) setting!: Setting<unknown>

	/** Marked when the palette opened the dialog on this row. */
	@property({ type: Boolean, reflect: true }) focused = false

	override role = 'listitem'

	readonly store = new SettingsStore(this)

	protected override createRenderRoot() { return this }

	static override get styles() {
		return css`
			mitra-setting-row {
				display: grid;
				grid-template-columns: 1.375rem minmax(0, 1fr) auto;
				align-items: center;
				gap: 0.875rem;
				padding-block: 0.625rem;
				padding-inline: 0.875rem;
				/* A field's tint and hairline, which every control on the card already wears. */
				border: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent);
				border-radius: 8px;
				background: color-mix(in srgb, var(--color-text) 3%, transparent);

				> mitra-icon, .details li > mitra-icon {
					font-size: 1.0625rem;
					color: var(--color-text-muted);
				}

				> mitra-source-icon {
					font-size: 1.0625rem;
				}

				.text {
					display: flex;
					flex-direction: column;
					gap: 0.125rem;
					min-inline-size: 0;

					.label {
						font-size: 0.875rem;
						font-weight: 500;
					}

					.hint {
						font-size: 0.75rem;
						color: var(--color-text-muted);
						text-wrap: pretty;
					}
				}

				> .control {
					display: flex;
					align-items: center;
					justify-content: flex-end;
					gap: 0.5rem;
					min-inline-size: 0;
					${controlHeight};
					min-block-size: var(--control-height);

					mitra-select {
						min-inline-size: 7rem;
						max-inline-size: 100%;
						font-weight: 400;
					}

					mitra-switch {
						--switch-block-size: 1.25rem;
					}

					/* A state the browser decides, granted or refused, in the chip's shape: success's colour, or error's. */
					.state {
						--_state: var(--color-success);
						font-size: 0.75rem;
						padding: 0.0625rem 0.5rem;
						border-radius: var(--border-radius);
						color: var(--_state);
						background: color-mix(in srgb, var(--_state) 14%, transparent);

						&[data-denied] {
							--_state: var(--color-error);
						}
					}
				}

				/* Below a hairline across the card, whatever they hold. */
				> .details {
					grid-column: 1 / -1;
					display: flex;
					flex-direction: column;
					margin-inline: -0.875rem;
					padding-inline: 0.875rem;
					border-block-start: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent);
					font-size: 0.8125rem;

					.note {
						margin: 0;
						padding-block: 0.625rem;
						padding-inline-start: calc(1.375rem + 0.875rem);
						color: var(--color-text-muted);

						a {
							color: var(--color-text);
							text-decoration: underline;
							text-underline-offset: 3px;
							text-decoration-color: color-mix(in srgb, currentColor 35%, transparent);

							&:hover {
								text-decoration-color: currentColor;
							}
						}
					}

					ul {
						display: flex;
						flex-direction: column;
						margin: 0;
						padding: 0;
						list-style: none;

						> li {
							display: grid;
							grid-template-columns: 1.375rem minmax(0, 1fr) auto;
							align-items: center;
							gap: 0.875rem;
							padding-block: 0.5rem;
							padding-inline: 0.875rem;
							margin-inline: -0.875rem;

							& + li {
								border-block-start: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent);
							}

							> .end {
								display: flex;
								align-items: center;
								gap: 0.5rem;

								> mitra-popover-container > mitra-icon-button {
									color: var(--color-text-muted);
									margin-block: -0.25rem;
								}
							}
						}
					}

					.chip {
						flex-shrink: 0;
						font-size: 0.6875rem;
						padding: 0.0625rem 0.375rem;
						border-radius: var(--border-radius);
						color: var(--color-text-muted);
						background: color-mix(in srgb, var(--color-text) 8%, transparent);
					}

					code {
						font-family: ui-monospace, 'Cascadia Code', monospace;
						font-size: 0.75rem;
						overflow: hidden;
						white-space: nowrap;
						text-overflow: ellipsis;
						user-select: all;
						-webkit-user-select: all;
					}
				}

				&[focused] {
					--focus-ring-color: var(--color-accent);
					${ring};
				}

				@container settings (max-width: 40rem) {
					&:has(> .control mitra-select) {
						grid-template-columns: 1.375rem minmax(0, 1fr);
						row-gap: 0.625rem;

						> .control {
							grid-column: 2;
							justify-content: flex-start;

							mitra-select {
								inline-size: 100%;
							}
						}
					}
				}
			}
		`
	}

	protected override get template() {
		return html`
			${this.setting.glyph}
			<div class="text">
				<span class="label">${this.setting.heading}</span>
				${!this.setting.hint ? html.nothing : html`<span class="hint">${this.setting.hint}</span>`}
			</div>
			<div class="control">${this.setting.control}</div>
			${this.setting.details === undefined ? html.nothing : html`<div class="details">${this.setting.details}</div>`}
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-setting-row': SettingRow
	}
}
