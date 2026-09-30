import { Component, component, css, event, html, ifDefined, property } from '@a11d/lit'
import { SheetController } from '@3mo/sheet/dist/SheetController.js'
import type { SheetPlacement } from '@3mo/sheet/dist/SheetPlacement.js'

/**
 * A modal panel on an edge of the viewport: it slides in, and closes by Escape, a press on the backdrop, its handle
 * or a swipe towards its edge. `open` binds both ways; `requestClose` (cancelable) fires before it closes itself.
 * For a surface that is a sheet wherever it shows, such as a narrow screen's sidebar, and a `mitra-popover`'s
 * presentation on a narrow screen.
 */
@component('mitra-modal-sheet')
export class ModalSheet extends Component {
	@event() readonly openChange!: EventDispatcher<boolean>

	@property({
		type: Boolean,
		reflect: true,
		bindingDefault: true,
		event: 'openChange',
		updated(this: ModalSheet, open: boolean, previous?: boolean) {
			if (previous !== undefined && previous !== open) {
				this.openChange.dispatch(open)
			}
		},
	}) open = false

	@property({ reflect: true }) placement: SheetPlacement = 'block-end'
	/** The sheet's accessible name. */
	@property() label?: string

	// Without an [autofocus] inside, the dialog itself takes focus as it opens, not its first control (the handle):
	// a sheet is read before it is edited.
	readonly controller = new SheetController(this, {
		autofocusTarget: () => this.querySelector<HTMLElement>('[autofocus]') ?? this.renderRoot.querySelector('dialog'),
	})

	static override get styles() {
		return css`
			/* The --mo-sheet-* properties are the motion controller's: it pins travel and origin while a gesture or exit runs. */
			:host {
				display: contents;
				--mo-sheet-travel-size: 100%;
			}

			/* Separate animations, so that a settled sheet exits with the full duration. */
			@keyframes slide-in {
				from { translate: var(--mo-sheet-motion-origin); }
			}

			@keyframes slide-out {
				from { translate: var(--mo-sheet-motion-origin); }
				to { translate: var(--_travel); }
			}

			@keyframes fade-in {
				from { opacity: 0; }
			}

			@keyframes fade-out {
				to { opacity: 0; }
			}

			dialog {
				--_duration: 0.25s;
				--_easing: cubic-bezier(0.2, 0, 0, 1);
				position: fixed;
				inset: 0;
				block-size: 100dvb;
				inline-size: 100dvi;
				max-block-size: none;
				max-inline-size: none;
				margin: 0;
				padding: 0;
				border: none;
				background: transparent;
				color: var(--color-text);
				overflow: clip;

				&::backdrop {
					background: rgb(0 0 0 / 0.4);
				}

				&[open] {
					[part=panel] { animation: slide-in var(--_duration) var(--_easing); }
					&::backdrop { animation: fade-in var(--_duration) var(--_easing); }
				}

				&[data-closing] {
					[part=panel] { animation: slide-out var(--_duration) var(--_easing) forwards; }
					&::backdrop { animation: fade-out var(--_duration) var(--_easing) forwards; }
				}

				&[data-placement^=block] [part=panel] {
					inset-inline: 0;
					max-inline-size: 30rem;
					margin-inline: auto;
					max-block-size: var(--mitra-modal-sheet-size, calc(100% - 2.5rem));
				}

				&[data-placement=block-end] [part=panel] {
					--_travel: 0 var(--mo-sheet-travel-size);
					inset-block-end: 0;
					border-start-start-radius: 1.25rem;
					border-start-end-radius: 1.25rem;
					padding-block-end: env(safe-area-inset-bottom);
				}

				&[data-placement=block-start] [part=panel] {
					--_travel: 0 calc(-1 * var(--mo-sheet-travel-size));
					inset-block-start: 0;
					border-end-start-radius: 1.25rem;
					border-end-end-radius: 1.25rem;
				}

				&[data-placement^=inline] {
					[part=panel] {
						inset-block: 0;
						inline-size: min(var(--mitra-modal-sheet-size, 20rem), calc(100% - 3rem));
						touch-action: pan-y;
					}

					[part=handle] {
						display: none;
					}
				}

				&[data-placement=inline-start] [part=panel] {
					--_travel: calc(-1 * var(--mo-sheet-travel-size)) 0;
					inset-inline-start: 0;
				}

				&[data-placement=inline-end] [part=panel] {
					--_travel: var(--mo-sheet-travel-size) 0;
					inset-inline-end: 0;
				}

				&:dir(rtl) {
					&[data-placement=inline-start] [part=panel] { --_travel: var(--mo-sheet-travel-size) 0; }
					&[data-placement=inline-end] [part=panel] { --_travel: calc(-1 * var(--mo-sheet-travel-size)) 0; }
				}
			}

			[part=panel] {
				--mo-sheet-motion-origin: var(--_travel);
				position: absolute;
				display: flex;
				flex-direction: column;
				box-sizing: border-box;
				background: var(--color-background);
				box-shadow: 0 10px 40px rgb(0 0 0 / 0.5);

				&[data-swipeability=swiping] {
					cursor: grabbing;
					user-select: none;
				}
			}

			[part=handle] {
				all: unset;
				display: flex;
				justify-content: center;
				padding-block: 0.5rem;
				cursor: grab;
				touch-action: none;

				&::before {
					content: '';
					inline-size: 2.25rem;
					block-size: 0.25rem;
					border-radius: 0.125rem;
					background: color-mix(in srgb, var(--color-text) 25%, transparent);
				}
			}
		`
	}

	protected override get template() {
		return html`
			<dialog part="dialog" tabindex="-1" aria-label=${ifDefined(this.label)} ${this.controller.dialog.ref()}>
				<div part="panel" ${this.controller.panel.ref()}>
					<button part="handle" aria-label=${t('Close')} ${this.controller.handle.ref()}></button>
					<slot></slot>
				</div>
			</dialog>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-modal-sheet': ModalSheet
	}
}
