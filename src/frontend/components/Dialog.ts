import { Component, component, html, css, property, state, query, event } from '@a11d/lit'
import { DialogComponent, DialogActionKey, type ApplicationTopLayer } from '@a11d/lit-application'
import { Mitra } from '../Mitra.js'

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
			}

			dialog {
				margin: auto;
				outline: none;
				background: color-mix(in srgb, var(--color-surface) 92%, transparent);
				backdrop-filter: blur(12px);
				color: var(--color-text);
				border: var(--border);
				border-radius: 14px;
				padding: 1.25rem;
				min-width: 360px;
				max-width: min(420px, 92vw);
				box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
				font-family: 'Inter', sans-serif;

				&::backdrop {
					background: rgba(0, 0, 0, 0.45);
				}

				/* Modern entry animation: @starting-style supplies the "from" state as the
				   native dialog moves into the top layer. Closing is instant (the host is
				   removed synchronously), so no exit transition is defined. */
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
			}

			.header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 1rem;

				h2 {
					margin: 0;
					font-size: 1.0625rem;
					font-weight: 650;
					letter-spacing: -0.01em;
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
					<header class="header">
						<h2>${this.heading}</h2>
						<mitra-icon-button icon="x" label="Close" @click=${() => this.handleAction(DialogActionKey.Cancellation)}></mitra-icon-button>
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
