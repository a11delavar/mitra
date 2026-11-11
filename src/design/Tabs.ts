import { Component, component, html, css, property, event, query, state } from '@a11d/lit'
import { ResizeController } from '@3mo/resize-observer'
import { focusRing } from './focusRing.css.js'
import { activated } from './activated.css.js'
import { controlHeight } from './controlHeight.css.js'
import { selectedBackground, selectedColor } from './selected.css.js'

// Where the strip rests between its first panel (0) and its last (1), and a tab's share of it (1 on its own panel).
// Only a registered number animates on a timeline and reads in a calc, and a shadow tree registers none.
for (const name of ['--mitra-tabs-position', '--mitra-tab-shown']) {
	try {
		globalThis.CSS?.registerProperty({ name, syntax: '<number>', inherits: true, initialValue: '0' })
	} catch {
		// Registered already: the module ran twice.
	}
}

/**
 * Declarative scroll-driven tab container pairing tabs and panels by name. Its tabs are plain buttons in a button's
 * outline, the open one a pressed one, and they follow the panels' scroll position itself, not its end.
 */
@component('mitra-tabs')
export class Tabs extends Component {
	/** Active tab name. */
	@property({ reflect: true }) selected?: string

	/** Shows only the open tab's name, the others their glyph and badge. */
	@property({ type: Boolean, reflect: true }) compact = false

	/** Fired when active tab changes. */
	@event() readonly selectedChange!: EventDispatcher<string>

	@query('[part=tablist]') private readonly tablist?: HTMLElement
	@query('[part=panels]') private readonly panels?: HTMLElement

	// Panels laid out while hidden (in a closed sheet) scrolled nowhere; once the tabs get a size, the selected one is shown.
	readonly resize = new ResizeController(this, { callback: () => this.reveal() })

	/** The tab a press is scrolling to: the panels passed on the way are not followed. */
	private heading?: string

	private get tabs() { return [...this.querySelectorAll('mitra-tab')] }
	private get panelElements() { return [...this.querySelectorAll('mitra-tab-panel')] }

	private get current() {
		return this.tabs.find(tab => tab.name === this.selected) ?? this.tabs[0]
	}

	/** The panel whose start the strip rests on. */
	private get resting() {
		const start = this.panels?.getBoundingClientRect().left
		return start === undefined ? undefined
			: this.panelElements.find(panel => Math.abs(panel.getBoundingClientRect().left - start) < 1)?.name
	}

	private select(name: string, { focus = false } = {}) {
		const moves = name !== this.current?.name
		if (name !== this.selected) {
			this.selected = name
			this.selectedChange.dispatch(name)
		}
		this.sync()
		this.reveal({ smooth: moves })
		if (focus) {
			this.tabs.find(tab => tab.name === name)?.focus()
		}
	}

	private sync() {
		const tabs = this.tabs
		const index = Math.max(0, tabs.indexOf(this.current!))
		tabs.forEach((tab, at) => {
			tab.selected = at === index
			tab.compact = this.compact
			tab.style.setProperty('--mitra-tab-index', String(at))
		})
		this.panelElements.forEach(panel => panel.selected = panel.name === tabs[index]?.name)
		this.tablist?.style.setProperty('--mitra-tab-count', String(tabs.length))
		// What the tabs read where no scroll timeline runs: a browser without them, or panels with no size yet.
		this.tablist?.style.setProperty('--mitra-tabs-position', String(tabs.length > 1 ? index / (tabs.length - 1) : 0))
	}

	private reveal({ smooth = false } = {}) {
		const name = this.current?.name
		const behavior = smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant'
		this.heading = behavior === 'smooth' ? name : undefined
		this.panelElements.find(panel => panel.name === name)?.scrollIntoView({ behavior, inline: 'start', block: 'nearest' })
	}

	/** Selects the panel the strip rests on, however it got there: a swipe, the keyboard, a find in the page. */
	private follow(name: string | null | undefined) {
		if (name && name !== this.selected) {
			this.selected = name
			this.selectedChange.dispatch(name)
			this.sync()
		}
	}

	// The panel whose start the strip rests on is the one shown. Read on every scroll, since Chrome's find in the page
	// jumps the strip with a bare `scroll`: no `scrollend` and no snap events.
	private readonly handleScroll = () => {
		const name = this.resting
		if (!this.heading || name === this.heading) {
			this.heading = undefined
			this.follow(name)
		}
	}

	// A scroll a press started can end elsewhere, taken over by a swipe.
	private readonly handleScrollEnd = () => {
		this.heading = undefined
		this.follow(this.resting)
	}

	private readonly handleClick = (e: Event) => {
		const tab = (e.target as HTMLElement).closest('mitra-tab')
		if (tab?.name) {
			this.select(tab.name)
		}
	}

	private readonly handleKeyDown = (e: KeyboardEvent) => {
		const tabs = this.tabs
		const forward = this.matches(':dir(rtl)') ? 'ArrowLeft' : 'ArrowRight'
		const backward = forward === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft'
		const step = e.key === forward ? 1 : e.key === backward ? -1 : 0
		const index = step ? tabs.findIndex(tab => tab.name === this.current?.name) + step
			: e.key === 'Home' ? 0
				: e.key === 'End' ? tabs.length - 1 : undefined
		const target = index === undefined ? undefined : tabs[Math.max(0, Math.min(index, tabs.length - 1))]
		if (target?.name) {
			e.preventDefault()
			this.select(target.name, { focus: true })
		}
	}

	protected override firstUpdated(changed: Map<PropertyKey, unknown>) {
		super.firstUpdated?.(changed)
		this.sync()
		this.reveal()
	}

	protected override updated(changed: Map<PropertyKey, unknown>) {
		super.updated?.(changed)
		if (changed.has('selected') || changed.has('compact')) {
			this.sync()
		}
	}

	static override get styles() {
		return css`
			:host {
				display: flex;
				min-block-size: 0;
				overflow: clip;
				${controlHeight};
			}

			/* Lets the tablist, a sibling of the scroller, read the scroller's timeline. Chromium finds no timeline
			   scoped on the host itself, so an element inside the shadow tree holds both. */
			[part=frame] {
				flex: 1;
				min-inline-size: 0;
				display: flex;
				flex-direction: column;
				gap: 1rem;
				timeline-scope: --panels;

				/* A button's outline without its fill, at a button's height: the strip is the control, so its tabs
				   give up what the outline and its padding take. The position is animated here and not on the host,
				   so the panels' own content never recalculates with it. */
				[part=tablist] {
					--mitra-tabs-inset: 3px;
					display: flex;
					gap: 2px;
					flex-shrink: 0;
					padding: 2px;
					border: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent);
					border-radius: calc(var(--border-radius) + 3px);
					animation: tabs-position linear both;
					animation-timeline: --panels;

					/* Without scroll-driven animations the position is the one set as a tab is selected, eased. */
					@supports not (animation-timeline: scroll()) {
						animation: none;
						transition: --mitra-tabs-position 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);

						@media (prefers-reduced-motion: reduce) {
							transition: none;
						}
					}

					::slotted(mitra-tab) {
						/* How far the strip is from this tab's panel, in panels: 0 on it, negative before it, positive past it. */
						--_distance: calc(var(--mitra-tabs-position) * (var(--mitra-tab-count) - 1) - var(--mitra-tab-index));
						--mitra-tab-shown: clamp(0, 1 - max(var(--_distance), -1 * var(--_distance)), 1);
						flex: 1 1 auto;
					}

					/* Only the open tab shows its name, so it takes the room the others leave, growing as its panel arrives. */
					&[data-compact] ::slotted(mitra-tab) {
						flex: var(--mitra-tab-shown) 0 auto;
					}

					/* The panels line up from the right there (below), so the position runs the other way. */
					&:dir(rtl) {
						animation-direction: reverse;
					}
				}

				[part=panels] {
					flex: 1;
					min-block-size: 0;
					display: flex;
					overflow-x: auto;
					overflow-y: hidden;
					scroll-snap-type: x mandatory;
					overscroll-behavior-inline: contain;
					scrollbar-width: none;
					scroll-timeline: --panels inline;

					&::-webkit-scrollbar {
						display: none;
					}

					/* Chromium places a view timeline one panel off in a scroller whose origin is its inline end, so
					   every panel faded out where it stood: the strip scrolls left to right, and in RTL its panels
					   line up from the right. */
					&:dir(rtl) {
						direction: ltr;

						::slotted(mitra-tab-panel) {
							direction: rtl;
							order: calc(-1 * sibling-index());
						}
					}
				}
			}

			@keyframes tabs-position {
				from { --mitra-tabs-position: 0; }
				to { --mitra-tabs-position: 1; }
			}
		`
	}

	protected override get template() {
		return html`
			<div part="frame">
				<div part="tablist" role="tablist" ?data-compact=${this.compact} @click=${this.handleClick} @keydown=${this.handleKeyDown}>
					<slot name="tab" @slotchange=${() => this.sync()}></slot>
				</div>
				<div part="panels" @scroll=${this.handleScroll} @scrollend=${this.handleScrollEnd}>
					<slot></slot>
				</div>
			</div>
		`
	}
}

/** Tab button within `<mitra-tabs>`: a plain button that becomes a pressed one as its panel arrives. */
@component('mitra-tab')
export class Tab extends Component {
	@property({ reflect: true }) name?: string
	@property() icon?: string
	@property({ type: Number }) badge?: number
	/** Written by the tabs. */
	@property({ type: Boolean, reflect: true }) compact = false

	@property({ type: Boolean, reflect: true, updated(this: Tab, value: boolean) {
		this.ariaSelected = String(value)
		this.tabIndex = value ? 0 : -1
	} }) selected = false

	@state() private label = ''

	override role = 'tab'

	protected override connected() {
		super.connected?.()
		this.slot = 'tab'
		this.tabIndex = this.selected ? 0 : -1
		if (this.name) {
			this.id ||= `tab-${this.name}`
			this.setAttribute('aria-controls', `panel-${this.name}`)
		}
	}

	// A tab showing its glyph alone names itself to screen readers and on hover.
	protected override updated(changed: Map<PropertyKey, unknown>) {
		super.updated?.(changed)
		this.ariaLabel = this.label || null
		this.title = this.compact ? this.label : ''
	}

	static override get styles() {
		return css`
			:host {
				display: flex;
				min-inline-size: var(--control-height);
				block-size: calc(var(--control-height) - 2 * var(--mitra-tabs-inset, 0px));
				border-radius: var(--border-radius);
				cursor: pointer;
				user-select: none;
			}

			/* The host is the tab among its siblings; this draws it, wearing the host's state so its rules nest. */
			[part=tab] {
				position: relative;
				isolation: isolate;
				box-sizing: border-box;
				flex: 1;
				min-inline-size: 0;
				display: flex;
				align-items: center;
				justify-content: center;
				padding-inline: 0.5rem;
				border-radius: inherit;
				color: color-mix(in srgb, ${selectedColor} calc(var(--mitra-tab-shown) * 100%), var(--color-text-muted));
				font-size: 0.8125rem;
				font-weight: calc(500 + var(--mitra-tab-shown) * 100);
				white-space: nowrap;

				&:hover {
					${activated};

					&:not([data-selected]) {
						color: var(--color-text);
					}
				}

				/* The selection's tint, one pill two neighbours each draw their share of: it leaves a tab towards
				   the next and enters that one from the side it came from. */
				&::before {
					content: '';
					position: absolute;
					z-index: -1;
					inset-block: 0;
					inset-inline: calc(clamp(0, var(--_distance), 1) * 100%) calc(clamp(0, -1 * var(--_distance), 1) * 100%);
					border-radius: inherit;
					background: ${selectedBackground};
				}

				/* A press anywhere in the strip's height is the tab's under it, so the target is a button's on touch too. */
				&::after {
					content: '';
					position: absolute;
					inset-block: calc(-1 * var(--mitra-tabs-inset, 0px));
					inset-inline: -1px;
				}

				mitra-icon {
					flex: none;
					font-size: 1rem;
				}

				[part=label] {
					min-inline-size: 0;
					margin-inline-start: 0.375rem;
					overflow: hidden;
					text-align: center;
					text-overflow: ellipsis;

					/* The name at the open tab's weight, unseen: it holds the width, so no tab shifts as one opens. */
					&::after {
						content: attr(data-name);
						display: block;
						block-size: 0;
						font-weight: 600;
						visibility: hidden;
					}
				}

				.badge {
					margin-inline-start: 0.25rem;
					font-size: 0.7rem;
					font-weight: 500;
					font-variant-numeric: tabular-nums;
					opacity: 0.7;
				}

				/* No width of its own, so a closed tab is its glyph: the name takes what the tab grew by. While the
				   tab moves it is cut softly where the tab ends, the fade as wide as the tab is far from open. */
				&[data-compact] [part=label] {
					--_fade: calc((1 - var(--mitra-tab-shown)) * 2rem);
					flex: 1;
					inline-size: 0;
					margin-inline-start: calc(var(--mitra-tab-shown) * 0.375rem);
					text-overflow: clip;
					opacity: var(--mitra-tab-shown);
					mask-image: linear-gradient(to right, black calc(100% - var(--_fade)), transparent);

					&:dir(rtl) {
						mask-image: linear-gradient(to left, black calc(100% - var(--_fade)), transparent);
					}

					/* Only a tab at rest says with three dots that its name does not fit. */
					@container style(--mitra-tab-shown: 1) {
						text-overflow: ellipsis;
					}
				}
			}

			${focusRing};
		`
	}

	protected override get template() {
		return html`
			<div part="tab" ?data-selected=${this.selected} ?data-compact=${this.compact}>
				${!this.icon ? html.nothing : html`<mitra-icon icon=${this.icon}></mitra-icon>`}
				<span part="label" data-name=${this.label}>
					<slot @slotchange=${() => this.label = this.textContent.trim()}></slot>
				</span>
				${!this.badge ? html.nothing : html`<span class="badge">${this.badge.format()}</span>`}
			</div>
		`
	}
}

/** Tab content panel paired with a `<mitra-tab>` by name. */
@component('mitra-tab-panel')
export class TabPanel extends Component {
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
			}

			/* Without scroll-driven animations the fade would run as a zero-length animation and rest invisible. */
			@supports (animation-timeline: view()) {
				:host {
					animation: tab-panel-fade linear both;
					animation-timeline: view(inline);
				}
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
