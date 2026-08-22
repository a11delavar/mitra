import { Component, component, html, css, property, event, query } from '@a11d/lit'
import { focusRing } from './focusRing.css.js'

/**
 * ```html
 * <mitra-tabs selected="calendars" @selectedChange=${…}>
 *   <mitra-tab name="calendars" icon="calendar-days">Calendars</mitra-tab>
 *   <mitra-tab-panel name="calendars">…</mitra-tab-panel>
 * </mitra-tabs>
 * ```
 *
 * A tab and its panel are written next to each other and paired by `name`; two slots sort them into
 * the rail and the carousel. Shadow DOM (as `mitra-icon` already uses) is what buys those slots —
 * the shadow holds two structural boxes, all author content stays slotted in the light DOM.
 *
 * Switching is a SCROLL: a snapping carousel, so trackpad and finger swipes are the compositor's,
 * and `scrollend` is the one path button, key, swipe and resize all commit through. No gesture code,
 * and there must not be. A button press JUMPS instead — the UA's distance-proportional smooth scroll
 * read as the tab sliding rather than changing.
 */
@component('mitra-tabs')
export class Tabs extends Component {
	/** The `name` of the tab on screen. */
	@property({ reflect: true }) selected?: string

	/** The settled tab's `name` — fired when it changes, whichever way it was reached. */
	@event() readonly selectedChange!: EventDispatcher<string>

	@query('[part=panels]') private readonly panels?: HTMLElement

	private get tabs() { return [...this.querySelectorAll('mitra-tab')] }
	private get panelElements() { return [...this.querySelectorAll('mitra-tab-panel')] }

	private get current() {
		return this.tabs.find(tab => tab.name === this.selected) ?? this.tabs[0]
	}

	private select(name: string, { focus = false } = {}) {
		if (name !== this.selected) {
			this.selected = name
			this.selectedChange.dispatch(name)
		}
		this.sync()
		this.reveal()
		if (focus) {
			this.tabs.find(tab => tab.name === name)?.focus()
		}
	}

	/** The children own how they look; this owns which one is on. */
	private sync() {
		const name = this.current?.name
		this.tabs.forEach(tab => tab.selected = tab.name === name)
		this.panelElements.forEach(panel => panel.selected = panel.name === name)
	}

	/** `inline: 'start'` is logical, so it lands right in RTL — unlike arithmetic on scrollLeft. */
	private reveal() {
		this.panelElements.find(panel => panel.name === this.current?.name)
			?.scrollIntoView({ behavior: 'instant', inline: 'start', block: 'nearest' })
	}

	/** Where the carousel came to rest IS the selection — measured, so it holds in RTL. */
	private readonly handleScrollEnd = () => {
		const panels = this.panelElements
		const start = this.panels?.getBoundingClientRect().left
		if (!panels.length || start === undefined) {
			return
		}
		const offset = (panel: Element) => Math.abs(panel.getBoundingClientRect().left - start)
		const nearest = panels.reduce((best, panel) => offset(panel) < offset(best) ? panel : best)
		if (nearest.name && nearest.name !== this.selected) {
			this.selected = nearest.name
			this.selectedChange.dispatch(nearest.name)
			this.sync()
		}
	}

	private readonly handleClick = (e: Event) => {
		const tab = (e.target as HTMLElement).closest('mitra-tab')
		if (tab?.name) {
			this.select(tab.name)
		}
	}

	/** The ARIA tablist keys, with automatic activation. */
	private readonly handleKeyDown = (e: KeyboardEvent) => {
		const tabs = this.tabs
		const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
		const index = step ? tabs.findIndex(tab => tab.name === this.current?.name) + step
			: e.key === 'Home' ? 0
				: e.key === 'End' ? tabs.length - 1 : undefined
		const target = index === undefined ? undefined : tabs[Math.max(0, Math.min(index, tabs.length - 1))]
		if (target?.name) {
			e.preventDefault()
			this.select(target.name, { focus: true })
		}
	}

	/** First update only: re-anchoring per render would fight the user's own swipe. */
	protected override firstUpdated(changed: Map<PropertyKey, unknown>) {
		super.firstUpdated?.(changed)
		this.sync()
		this.reveal()
	}

	protected override updated(changed: Map<PropertyKey, unknown>) {
		super.updated?.(changed)
		if (changed.has('selected')) {
			this.sync()
		}
	}

	static override get styles() {
		return css`
			:host {
				display: flex;
				flex-direction: column;
				min-block-size: 0;
				gap: 1rem;
				/* Looks redundant against the scroller, but a light-tree walk cannot see a clip declared
				   inside a shadow root — and one asks whether an off-screen panel is on screen (see
				   EntryDragController.visibleBox). */
				overflow: clip;
			}

			[part=tablist] {
				display: grid;
				grid-auto-flow: column;
				grid-auto-columns: 1fr;
				gap: 2px;
				flex-shrink: 0;
				padding: 2px;
				border-radius: calc(var(--border-radius) + 2px);
				background: color-mix(in srgb, var(--color-text) 8%, transparent);
			}

			/* Inline overflow only, each panel scrolling itself — that is what lets the browser axis-lock
			   a finger. No scroll-behavior: every programmatic move here is a jump (see reveal). */
			[part=panels] {
				flex: 1;
				min-block-size: 0;
				display: flex;
				overflow-x: auto;
				overflow-y: hidden;
				scroll-snap-type: x mandatory;
				overscroll-behavior-inline: contain;
				scrollbar-width: none;
			}

			[part=panels]::-webkit-scrollbar {
				display: none;
			}
		`
	}

	protected override get template() {
		return html`
			<div part="tablist" role="tablist" @click=${this.handleClick} @keydown=${this.handleKeyDown}>
				<slot name="tab"></slot>
			</div>
			<div part="panels" @scrollend=${this.handleScrollEnd}>
				<slot></slot>
			</div>
		`
	}
}

/** One mode's button; its label is its content. */
@component('mitra-tab')
export class Tab extends Component {
	/** Pairs it with the `mitra-tab-panel` of the same name. */
	@property({ reflect: true }) name?: string
	@property() icon?: string
	@property({ type: Number }) badge?: number

	@property({ type: Boolean, reflect: true, updated(this: Tab, value: boolean) {
		this.ariaSelected = String(value)
		this.tabIndex = value ? 0 : -1
	} }) selected = false

	override role = 'tab'

	protected override connected() {
		super.connected?.()
		this.slot = 'tab' // so the author never writes a slot attribute
		this.tabIndex = this.selected ? 0 : -1
		if (this.name) {
			this.id ||= `tab-${this.name}`
			this.setAttribute('aria-controls', `panel-${this.name}`)
		}
	}

	static override get styles() {
		return css`
			:host {
				display: flex;
				align-items: center;
				justify-content: center;
				gap: 0.375rem;
				box-sizing: border-box;
				padding: 0.35rem 0.5rem;
				border-radius: var(--border-radius);
				font-size: 0.8rem;
				font-weight: 500;
				color: var(--color-text-muted);
				white-space: nowrap;
				cursor: pointer;
				user-select: none;
				transition: color 0.15s ease, background 0.15s ease;
			}

			:host(:hover) {
				color: var(--color-text);
			}

			/* The thumb must move AWAY from a rail that is itself a tint of the text colour, so the two
			   schemes want opposite fills. (--color-surface is within a hair of the background in dark,
			   and vanished into the rail.) */
			:host([selected]) {
				color: var(--color-text);
				background: light-dark(var(--color-background), color-mix(in srgb, var(--color-text) 14%, transparent));
				box-shadow: 0 1px 2px rgb(0 0 0 / 0.18);
			}

			mitra-icon {
				font-size: 1rem;
			}

			/* A count, not an alert — nothing here is overdue. */
			.badge {
				font-size: 0.7rem;
				font-variant-numeric: tabular-nums;
				color: var(--color-text-muted);
			}

			${focusRing};
		`
	}

	protected override get template() {
		return html`
			${!this.icon ? html.nothing : html`<mitra-icon icon=${this.icon}></mitra-icon>`}
			<slot></slot>
			${!this.badge ? html.nothing : html`<span class="badge">${this.badge}</span>`}
		`
	}
}

/** What is behind one tab; everything inside stays in the light DOM. */
@component('mitra-tab-panel')
export class TabPanel extends Component {
	/** Pairs it with the `mitra-tab` of the same name. */
	@property({ reflect: true }) name?: string
	@property({ type: Boolean, reflect: true }) selected = false

	override role = 'tabpanel'

	protected override connected() {
		super.connected?.()
		if (this.name) {
			this.id ||= `panel-${this.name}`
			this.setAttribute('aria-labelledby', `tab-${this.name}`)
		}
	}

	static override get styles() {
		return css`
			:host {
				flex: 0 0 100%;
				min-inline-size: 0;
				display: flex;
				flex-direction: column;
				scroll-snap-align: start;
				scroll-snap-stop: always;

				/* A half-way swipe crossfades. Opacity is the one property safe to animate on a scroll
				   track (see the bottom sheet), and a panel exactly the scrollport's width puts the
				   default view() range at full opacity dead centre, where a snap rests. NO base opacity:
				   an inactive timeline falls back to the base style, which must be the visible one. */
				animation: tab-panel-fade linear both;
				animation-timeline: view(inline);
			}

			@keyframes tab-panel-fade {
				0% { opacity: 0; }
				50% { opacity: 1; }
				100% { opacity: 0; }
			}
		`
	}

	protected override get template() {
		return html`<slot></slot>`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-tabs': Tabs
		'mitra-tab': Tab
		'mitra-tab-panel': TabPanel
	}
}
