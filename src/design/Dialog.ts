import { Component, component, html, css, property, state, query, event, type PropertyValues } from '@a11d/lit'
import { DialogComponent, DialogActionKey, type ApplicationTopLayer } from '@a11d/lit-application'
import { Mitra } from '../app/Mitra.js'
import './Button.js'
import './IconButton.js'
import { fieldChromeRestored } from './fieldChrome.css.js'

/**
 * The dialog chrome of a `DialogComponent`, or a dialog of its own where none takes it over: bound through `open`,
 * it then closes itself (its X, Escape, a press outside) with `openChange`, and its primary button fires `primaryAction`.
 * Rendered where it is used, it keeps a popover it opens from open, which a dialog appended elsewhere would dismiss.
 */
@component('mitra-dialog')
@DialogComponent.dialogElement()
export class Dialog extends Component {
	@event({ bubbles: true, composed: true, cancelable: true }) readonly pageHeadingChange!: EventDispatcher<string>
	@event() readonly openChange!: EventDispatcher<boolean>
	@event() readonly primaryAction!: EventDispatcher

	@property() heading = ''
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

	@property({
		type: Boolean,
		updated(this: Dialog, open: boolean) {
			if (open && !this.dialog.open) {
				this.dialog.showModal()
			} else if (!open) {
				this.dialog.close()
			}
		}
	}) open = false

	private readonly standaloneAction = (key: DialogActionKey) => {
		if (key === DialogActionKey.Primary) {
			this.primaryAction.dispatch()
		} else {
			this.open = false
			this.openChange.dispatch(false)
		}
	}

	/** A `DialogComponent` replaces this with its own. */
	handleAction: (key: DialogActionKey) => void | Promise<void> = this.standaloneAction

	private get standalone() {
		return this.handleAction === this.standaloneAction
	}

	// A DialogComponent answers Escape itself, so the platform's own dismissal only ever stands for a standalone dialog.
	private readonly handleCancel = (e: Event) => {
		e.preventDefault()
		if (this.standalone) {
			this.handleAction(DialogActionKey.Cancellation)
		}
	}

	@query('dialog') private readonly dialog!: HTMLDialogElement

	// The heading names the window only when the dialog is its page (popped out). In place, even closed, it renamed the tab.
	protected override updated(changed: PropertyValues<this>) {
		super.updated(changed)
		if (this.boundToWindow && (changed.has('heading') || changed.has('boundToWindow'))) {
			this.pageHeadingChange.dispatch(this.heading)
		}
	}
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
				${fieldChromeRestored};
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
				font-family: var(--font-family);

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
			<dialog part="dialog" .closedBy=${this.standalone ? 'any' : 'closerequest'} @cancel=${this.handleCancel}>
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
							<mitra-button variant="primary" ?disabled=${this.primaryButtonDisabled || this.executingAction === DialogActionKey.Primary} @click=${() => this.handleAction(DialogActionKey.Primary)}>
								${this.primaryButtonText}
							</mitra-button>
						`}
					</footer>
				</div>
				<!-- Dialogs go to the last top layer connected, so a closed standalone one (the editor's Repeat, its
					reminders) must hold none: every dialog would land inside the editor, and go down with it. -->
				${this.standalone && !this.open ? html.nothing : html`<lit-application-top-layer></lit-application-top-layer>`}
			</dialog>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-dialog': Dialog
	}
}
