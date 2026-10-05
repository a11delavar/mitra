import { Component, component, css, event, html, property } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { ResizeController } from '@3mo/resize-observer'
import { scrollbar } from './scrollbar.css.js'
import { slots } from './slots.css.js'

/**
 * The times of a day to pick one from, every `step` minutes in the language's clock; `value` is the `HH:mm` of a native
 * time input. The time in force is marked, and the list shows it, or the last time before it, whenever it appears. Up
 * and Down walk the times.
 */
@component('mitra-time-picker')
export class TimePicker extends Component {
	@event() readonly pick!: EventDispatcher<string>

	@property() value?: string
	@property({ type: Number }) step = 30

	// Laid out while its popover is closed, it has no size to scroll in until it appears.
	readonly resize = new ResizeController(this, { callback: () => this.reveal() })

	/** Every `step` minutes of a winter day, so that no clock change skips or doubles one. */
	private get times() {
		const day = new DateTime('2000-01-01T00:00:00')
		const pad = (value: number) => String(value).padStart(2, '0')
		return Array.from({ length: Math.ceil(24 * 60 / this.step) }, (_, index) => {
			const time = day.add({ minutes: index * this.step })
			return { value: `${pad(time.hour)}:${pad(time.minute)}`, label: time.format({ hour: 'numeric', minute: '2-digit' }) }
		})
	}

	/** The option of the time in force, or of the last one before it. */
	private get current() {
		return this.renderRoot.querySelector<HTMLElement>('[role=option][tabindex="0"]') ?? undefined
	}

	private reveal() {
		const { current } = this
		if (current) {
			this.scrollTop += current.getBoundingClientRect().top - this.getBoundingClientRect().top - (this.clientHeight - current.offsetHeight) / 2
		}
	}

	/** Puts the focus on the time in force, for a picker the keyboard opened. */
	override focus() {
		void this.updateComplete.then(() => {
			this.reveal()
			this.current?.focus()
		})
	}

	private readonly handleKeyDown = (e: KeyboardEvent) => {
		const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
		if (step) {
			e.preventDefault()
			const options = [...this.renderRoot.querySelectorAll<HTMLElement>('[role=option]')]
			options[options.indexOf((this.renderRoot as ShadowRoot).activeElement as HTMLElement) + step]?.focus()
		}
	}

	static override get styles() {
		return css`
			:host {
				display: flex;
				flex-direction: column;
				max-block-size: 16rem;
				overflow-y: auto;
				${scrollbar};
			}

			[role=listbox] {
				${slots};
			}
		`
	}

	protected override get template() {
		const { times, value } = this
		const current = value === undefined ? 0 : Math.max(0, times.findLastIndex(time => time.value <= value))
		return html`
			<div role="listbox" aria-label=${t('Choose a time')} @keydown=${this.handleKeyDown}>
				${times.map((time, index) => html`
					<button role="option" tabindex=${index === current ? 0 : -1} aria-selected=${time.value === value}
						@click=${() => this.pick.dispatch(time.value)}
					>${time.label}</button>
				`)}
			</div>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-time-picker': TimePicker
	}
}
