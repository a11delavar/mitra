import { css, event, html, ifDefined, property, query, type ElementRef, type ElementRefs, type HTMLTemplateResult, type PropertyValues } from '@a11d/lit'
import { Control } from './Control.js'
import { type Popover } from './Popover.js'
import { controlHeight } from './controlHeight.css.js'
import './IconButton.js'
import { disabled } from './disabled.css.js'
import { fieldChrome } from './fieldChrome.css.js'

/**
 * What the date, time and duration fields share: typed segments in the language's order, digits and calendar, a button
 * and Alt+ArrowDown for a picker, and a `change` carrying the value. What is slotted (a row's
 * actions) sits at the end of the box. A context that wears the box itself (the entry editor's rows) sets
 * `--mitra-field-*`: the box sheds its chrome and its button, and a click on the box stands for the button.
 */
export abstract class SegmentedField<T, TSegment> extends Control {
	/** A native `change` stops at the shadow root; this one carries the value. */
	@event() readonly change!: EventDispatcher<T | undefined>

	@property({ type: Object, bindingDefault: true, event: 'change' }) value?: T
	@property() label?: string
	@property({ type: Boolean, reflect: true }) readonly = false
	@property({ type: Boolean, reflect: true }) disabled = false

	@query('mitra-popover') protected readonly picker?: Popover

	protected abstract readonly controller: {
		readonly group: ElementRef<HTMLElement, void>
		readonly segment: ElementRefs<HTMLElement, TSegment>
		focus(): void
	}
	protected abstract get segments(): ReadonlyArray<TSegment>
	/** The `part` a segment exposes, for a context to style it from outside. */
	protected segmentPart(_segment: TSegment): string | undefined {
		return undefined
	}
	protected abstract readonly icon: string
	protected abstract readonly pickerLabel: string
	protected abstract get pickerTemplate(): HTMLTemplateResult

	protected commit(value: T | undefined) {
		if (value !== this.value) {
			this.value = value
			this.change.dispatch(value)
		}
	}

	/** The value the segments last rendered. */
	private rendered?: T

	protected override updated(changed: PropertyValues<this>) {
		super.updated(changed)
		this.rendered = this.value
	}

	/**
	 * Commits what the segments hold, unless they are behind the value in force: a focused field removed before it
	 * renders a new value commits its old one on blur.
	 */
	protected commitSegments(value: T | undefined) {
		if (this.value === this.rendered) {
			this.commit(value)
		}
	}

	/**
	 * Whether the units read left to right in a right-to-left language, as Persian writes a date and a time, though
	 * `@3mo/segmented-input` lays them out right to left.
	 */
	protected readonly readsLeftToRight: boolean = false

	private get leftToRight() {
		return this.readsLeftToRight && this.matches(':dir(rtl)')
	}

	// The segments' controller walks them in the language's direction: laid out left to right, the arrows walk the other way.
	private readonly mirrorArrows = (e: KeyboardEvent) => {
		const opposite = e.key === 'ArrowLeft' ? 'ArrowRight' : e.key === 'ArrowRight' ? 'ArrowLeft' : undefined
		if (opposite && e.isTrusted && this.leftToRight) {
			e.stopImmediatePropagation()
			e.preventDefault()
			e.target!.dispatchEvent(new KeyboardEvent('keydown', { key: opposite, bubbles: true, composed: true, cancelable: true }))
		}
	}

	/** Whether the picker opening takes the focus: from the keyboard it does, while a pointer keeps typing in the segments. */
	private focusesPicker = false

	/** Opens the picker, as `showPicker()` does a native input's. */
	showPicker({ focus = false } = {}) {
		if (!this.readonly && !this.disabled) {
			this.focusesPicker = focus
			this.picker?.show(this)
		}
	}

	// A press on what is slotted is that content's own, never the box's.
	private readonly handleBoxClick = (e: MouseEvent) => {
		const button = this.renderRoot.querySelector('mitra-icon-button')
		if (button && getComputedStyle(button).display === 'none' && !e.defaultPrevented && !e.composedPath().includes(this.renderRoot.querySelector('slot')!)) {
			this.showPicker()
		}
	}

	protected closePicker() {
		this.picker?.hide()
		this.controller.focus()
	}

	override focus() {
		this.controller.focus()
	}

	static override get styles() {
		return css`
			:host {
				${controlHeight};
				display: inline-flex;
				min-inline-size: 0;
				font-size: 0.8125rem;
				font-weight: 500;
				color: var(--color-text);
			}

			[part=box] {
				${fieldChrome};
				flex: 1;
				display: flex;
				align-items: center;
				gap: 0.25rem;
				padding-inline: var(--mitra-field-padding, 0.75rem 0.25rem);
			}

			:host([disabled]) [part=box] {
				${disabled};
			}

			:host([readonly]) [part=box] {
				opacity: var(--mitra-field-readonly-opacity, 0.55);
			}

			[part=segments] {
				flex: 1;
				min-inline-size: 0;
				white-space: nowrap;
				/* A date reads left to right in any script, but it sits where the field's own text starts. Chromium knows
				   only the prefixed keyword. */
				text-align: -webkit-match-parent;
				text-align: match-parent;
				font-variant-numeric: tabular-nums;
				cursor: text;

				> * {
					outline: none;
					caret-color: transparent;
					user-select: none;
				}

				> [role] {
					border-radius: 0.2rem;
					padding-inline: 1px;

					&:focus {
						background: color-mix(in srgb, var(--color-accent) 40%, transparent);
					}

					&[data-placeholder] {
						color: var(--color-text-muted);
					}
				}

				> [aria-hidden] {
					color: var(--color-text-muted);
				}

				&[data-left-to-right] {
					direction: ltr;
				}
			}

			mitra-icon-button {
				display: var(--mitra-field-button, inline-flex);
				color: var(--color-text-muted);
				margin-inline-end: calc(-1 * var(--mitra-glyph-inset) + 0.125rem);
			}

			mitra-popover {
				padding: 0.5rem;
			}
		`
	}

	protected override get template() {
		const { controller } = this
		return html`
			<div part="box" @click=${this.handleBoxClick}>
				<div part="segments" ?data-left-to-right=${this.leftToRight} @keydown=${{ handleEvent: this.mirrorArrows, capture: true }} ${controller.group.ref()}>
					${this.segments.map(segment => html`<span part=${ifDefined(this.segmentPart(segment))} ${controller.segment.ref(segment)}></span>`)}
				</div>
				<slot></slot>
				${this.readonly || this.disabled ? html.nothing : html`
					<mitra-icon-button size="small" tabindex="-1" icon=${this.icon} label=${this.pickerLabel} @click=${() => this.showPicker({ focus: true })}></mitra-icon-button>
				`}
			</div>
			<mitra-popover @openChange=${(e: CustomEvent<boolean>) => e.detail ? this.pickerOpened(this.focusesPicker) : this.pickerClosed()}>${this.pickerTemplate}</mitra-popover>
		`
	}

	protected pickerOpened(_focus: boolean) { }

	protected pickerClosed() { }
}
