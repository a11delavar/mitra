import { Component, component, html, css, property, state, query, event } from '@a11d/lit'
import { DialogComponent, DialogActionKey, type ApplicationTopLayer } from '@a11d/lit-application'
import { Mitra } from '../app/Mitra.js'

@component('mitra-dialog')
@DialogComponent.dialogElement()
export class Dialog extends Component {
	@event({ bubbles: true, composed: true, cancelable: true }) readonly pageHeadingChange!: EventDispatcher<string>

	@property({ updated(this: Dialog) { this.pageHeadingChange.dispatch(this.heading) } }) heading = ''
	@property() errorHandler?: (error: Error) => void | Promise<void>
	@property({ type: Boolean }) preventCancellationOnEscape = false
	@property({ type: Boolean }) primaryOnEnter = false

	/** When set, the footer shows a built-in accent primary button that triggers the dialog's primary action. */
	@property() primaryButtonText?: string
	@property({ type: Boolean }) primaryButtonDisabled = false

	@state() poppable = false
	@state() boundToWindow = false
	@state() executingAction?: DialogActionKey
	@state() private hasFooter = false

	@state({
		updated(this: Dialog, open: boolean) {
			if (open) {
				this.dialog.showModal()
			} else {
				this.dialog.close()
			}
		}
	}) open = false

	handleAction!: (key: DialogActionKey) => void | Promise<void>

	@query('dialog') private readonly dialog!: HTMLDialogElement
	@query('lit-application-top-layer') readonly topLayerElement!: ApplicationTopLayer

	get primaryActionElement(): HTMLElement | undefined { return undefined }
	get secondaryActionElement(): HTMLElement | undefined { return undefined }
	get cancellationActionElement(): HTMLElement | undefined { return undefined }

	static override get styles() {
		return css`
			${Mitra.styles}

			:host {
				display: contents;
				--color-background: light-dark(
					var(--color-background-seed),
					color-mix(in srgb, var(--color-background-seed), white 4.5%)
				);
			}

			dialog {
				margin: auto;
				outline: none;
				background: var(--color-background);
				backdrop-filter: blur(12px);
				color: var(--color-text);
				border: var(--border);
				border-radius: 14px;
				--mitra-dialog-padding: 1.25rem;
				padding: var(--mitra-dialog-padding);
				box-sizing: border-box;
				min-width: min(360px, 92vw);
				width: var(--mitra-dialog-width, auto);
				max-width: var(--mitra-dialog-width, min(420px, 92vw));
				box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
				font-family: 'Inter', sans-serif;

				&::backdrop {
					background: rgba(0, 0, 0, 0.45);
				}

				@media (display-mode: window-controls-overlay) {
					-webkit-app-region: no-drag;
				}

				@media (prefers-reduced-motion: no-preference) {
					transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.2, 0.9, 0.3, 1);

					@starting-style {
						opacity: 0;
						transform: scale(0.95) translateY(8px);
					}
				}
			}

			.panel {
				display: flex;
				flex-direction: column;
				gap: 1.125rem;
				width: 100%;
				position: relative;
			}

			.header {
				display: flex;
				align-items: center;
				gap: 0.75rem;

				> mitra-icon-button {
					--icon-button-size: 2rem;
					font-size: 1.0625rem;
				}

				h2 {
					flex: 1;
					margin: 0;
					font-size: 1rem;
					font-weight: 600;
				}

				&[data-headingless] {
					position: absolute;
					inset-block-start: var(--mitra-dialog-header-inset, 0);
					inset-inline-end: var(--mitra-dialog-header-inset, 0);
					margin: 0;
					z-index: 1;

					h2 {
						display: none;
					}
				}
			}

			.footer {
				display: flex;
				justify-content: flex-end;
				gap: 0.5rem;

				&[data-empty] {
					display: none;
				}
			}
		`
	}

	protected override get template() {
		return html`
			<dialog part="dialog" @cancel=${(e: Event) => e.preventDefault()}>
				<div class="panel">
					<header class="header" ?data-headingless=${!this.heading}>
						<slot name="leading"></slot>
						<h2>${this.heading}</h2>
						<mitra-icon-button icon="x" label=${t('Close')} @click=${() => this.handleAction(DialogActionKey.Cancellation)}></mitra-icon-button>
					</header>
					<slot></slot>
					<footer class="footer" ?data-empty=${!this.primaryButtonText && !this.hasFooter}>
						<slot name="footer" @slotchange=${(e: Event) => this.hasFooter = (e.target as HTMLSlotElement).assignedElements().length > 0}></slot>
						${!this.primaryButtonText ? html.nothing : html`
							<button class="primary" ?disabled=${this.primaryButtonDisabled || this.executingAction === DialogActionKey.Primary} @click=${() => this.handleAction(DialogActionKey.Primary)}>
								${this.primaryButtonText}
							</button>
						`}
					</footer>
				</div>
				<lit-application-top-layer></lit-application-top-layer>
			</dialog>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-dialog': Dialog
	}
}
