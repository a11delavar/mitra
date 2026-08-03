import { Component, component, html, css, property, event, query } from '@a11d/lit'
import { type Entry, TaskStatus } from 'shared'
import { getCapabilities } from '../Api.js'
import { EntryStore } from '../EntryStore.js'

const order = [TaskStatus.ToDo, TaskStatus.Doing, TaskStatus.Done, TaskStatus.Cancelled] as const

const icon = new Map<TaskStatus, string>([
	[TaskStatus.ToDo, 'square'],
	[TaskStatus.Doing, 'square-minus'],
	[TaskStatus.Done, 'square-check-big'],
	[TaskStatus.Cancelled, 'square-x'],
])

// Resolved per render (not once at module load): `t` must be called at render time so the label follows
// a language switch, and so it never runs before the global `t` is assigned.
function label(status: TaskStatus): string {
	switch (status) {
		case TaskStatus.ToDo: return t('To Do')
		case TaskStatus.Doing: return t('Doing')
		case TaskStatus.Done: return t('Done')
		case TaskStatus.Cancelled: return t('Cancelled')
	}
}

/**
 * A task's completion control, reused in the grid segment and the entry popover. A plain click is the
 * fast path — it toggles To Do ⇄ Done. Alt-click (or right-click) opens an anchored menu of all four
 * statuses for precise selection. It mutates `entry.status` in place and fires `change`; the host decides
 * how to persist (the segment updates immediately, the popover routes through its draft/create flow).
 */
@component('mitra-task-status')
export class TaskStatusComponent extends Component {
	@property({ type: Object }) entry!: Entry

	/** Fired after the entry's status is mutated in place, so the host can persist and re-render. */
	@event() readonly change!: EventDispatcher

	// Subscribe to the store so a re-render fires when the entry mutates in place. A source migration
	// changes `entry.sourceId` on the SAME instance, so the `@property` reference is unchanged and lit
	// wouldn't re-render on its own — this keeps the Cancelled option out of the menu once the entry
	// moves to a provider (e.g. Notion) that can't represent it.
	readonly store = new EntryStore(this)

	protected override createRenderRoot() { return this }

	private get status() {
		return this.entry?.status ?? TaskStatus.ToDo
	}

	@query('menu[popover]') private readonly menu?: HTMLElement

	private commit(status: TaskStatus) {
		if (this.entry.status === status) {
			this.menu?.hidePopover()
			return
		}
		this.entry.status = status
		this.menu?.hidePopover()
		this.requestUpdate()
		this.change.dispatch()
	}

	// Stop the click from bubbling to the segment (which would open the editor popover).
	private readonly onToggle = (e: MouseEvent) => {
		e.stopPropagation()
		e.preventDefault()
		if (e.altKey) {
			this.menu?.togglePopover()
			return
		}
		this.commit(this.status === TaskStatus.Done ? TaskStatus.ToDo : TaskStatus.Done)
	}

	private readonly onContextMenu = (e: MouseEvent) => {
		// Right-click is the conventional "more options" affordance for the same menu.
		e.preventDefault()
		e.stopPropagation()
		this.menu?.togglePopover()
	}

	private readonly pick = (status: TaskStatus) => (e: Event) => {
		e.stopPropagation()
		this.commit(status)
	}

	static override get styles() {
		return css`
			mitra-task-status {
				display: inline-flex;
				flex-shrink: 0;

				/* The host IS the menu's anchor, and anchor-scope confines the name to this instance —
				   so the grid copy and the popover copy of the same task share one name without
				   colliding, and no per-instance token is needed. */
				anchor-name: --task-status;
				anchor-scope: --task-status;

				> menu[popover] {
					position-anchor: --task-status;
					/* The entry's tinted glass, like every other surface it opens (see EntrySegment) — the
					   plain menu surface underneath is the app's neutral one and read as a foreign panel
					   floating over the entry. Addressed as a child so it simply out-specifies menu.css.ts;
					   no !important needed. */
					background: var(--mitra-entry-surface);
				}

				& > mitra-icon-button {
					transition: transform 0.1s ease;

					&:active { transform: scale(0.9); }

					> button {
						padding: 0;

						/* Nothing drawn behind the mark, and no colour jump: hovering just brings it up to
						   full strength (IconButton's own hover opacity, faded there). The shared activated
						   surface every other icon button wears is mixed from the app's TEXT colour and knows
						   nothing about the chip it sits on — a foreign grey square behind a square glyph,
						   invisible on a pale entry and muddy on a saturated one. It stays for :focus-visible,
						   where it is not decoration but half of how a keyboard user finds the control. */
						&:hover:not(:focus-visible) { background: none; }
					}
				}

				/* In a grid bar this control is sized by the line it sits on, and it opts out of the touch
				   floor every other icon button grows to (a bar can be a single line tall, which that floor
				   would burst) — both decided by the segment, on the BUTTON itself: see the header line in
				   EntrySegment. Not here, and not on this host: IconButton declares the floor on the button
				   element, and an element's own declaration beats anything it inherits, so an opt-out set
				   here would read as applied and quietly lose on every coarse pointer. This copy — the
				   editor's — keeps the growth. */
			}
		`
	}

	protected override get template() {
		return !this.entry?.type.isTask ? html.nothing : html`
			<mitra-icon-button aria-label=${label(this.status)}
				title=${t('${status} — click to toggle, Alt-click for options', { status: label(this.status) })}
				@click=${this.onToggle}
				@contextmenu=${this.onContextMenu} icon=${icon.get(this.status)!}
			></mitra-icon-button>
			<menu popover>
				${order.filter(status => status !== TaskStatus.Cancelled || getCapabilities(this.entry.sourceId).cancelledStatus).map(status => html`
					<button aria-current=${status === this.status} @click=${this.pick(status)}>
						<mitra-icon icon=${icon.get(status)!}></mitra-icon>
						${label(status)}
					</button>
				`)}
			</menu>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-task-status': TaskStatusComponent
	}
}
