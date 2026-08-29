import { Component, component, html, css, property } from '@a11d/lit'
import { controlHeight } from '../../../design/controlHeight.css.js'
import { ring } from '../../../design/focusRing.css.js'
import { type Setting } from './Setting.js'
import { SettingsStore } from './SettingsStore.js'

/**
 * Settings row component rendering leading glyph, label with optional hint, and trailing control.
 */
@component('mitra-setting-row')
export class SettingRow extends Component {
	@property({ type: Object }) setting!: Setting<unknown>

	/** Marked when the palette opened the dialog on this row. */
	@property({ type: Boolean, reflect: true }) focused = false

	override role = 'listitem'

	readonly store = new SettingsStore(this)

	protected override createRenderRoot() { return this }

	protected override updated() {
		this.setting.syncControl(this)
	}

	static override get styles() {
		return css`
			mitra-setting-row {
				display: grid;
				grid-template-columns: 1.375rem minmax(0, 1fr) auto;
				align-items: center;
				gap: 0.875rem;
				padding-block: 0.625rem;
				padding-inline: 0.5rem;
				margin-inline: -0.5rem;
				border-radius: 8px;

				&:not(:last-of-type) {
					border-block-end: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent);
				}

				> mitra-icon {
					font-size: 1.0625rem;
					color: var(--color-text-muted);
				}

				> mitra-source-icon {
					font-size: 1.0625rem;
				}

				> .text {
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
					min-inline-size: 0;
					${controlHeight};
					min-block-size: var(--control-height);

					select {
						field-sizing: content;
						min-inline-size: 7rem;
						max-inline-size: 100%;
						justify-content: space-between;
						font-weight: 400;

						selectedcontent {
							overflow: hidden;
							text-overflow: ellipsis;
							white-space: nowrap;
						}
					}

					.switch {
						--switch-block-size: 1.25rem;
					}

					.state {
						font-size: 0.8125rem;
						color: var(--color-text-muted);

						&[data-denied] {
							color: var(--color-error);
						}
					}
				}

				> .details {
					grid-column: 1 / -1;
					margin-block-start: 0.625rem;
					margin-inline-start: calc(1.375rem + 0.875rem);
				}

				&[focused] {
					--focus-ring-color: var(--color-accent);
					${ring};
					border-block-end-color: transparent;
				}

				@container settings (max-width: 40rem) {
					&:has(> .control select) {
						grid-template-columns: 1.375rem minmax(0, 1fr);
						row-gap: 0.625rem;

						> .control {
							grid-column: 2;
							justify-content: flex-start;

							select {
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
