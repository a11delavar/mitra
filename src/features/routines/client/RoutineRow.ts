import { Component, component, css, eventListener, html, property, state } from '@a11d/lit'
import { contrastColorOf } from '#design'
import { Calendars } from '#features/sources/client/Calendars.js'
import type { Entry } from '#features/entries'
import { EntryStore, reportSaveError } from '#features/entries/client/EntryStore.js'
import { type Routine } from '../Routine.js'
import { RoutineStore } from './RoutineStore.js'
import './RoutineFlame.js'
import './RoutineDetails.js'

/**
 * One routine in the sidebar's tab, a card in its calendar's colour: its name, how often it comes, today's tick for a task,
 * and its streak. A click opens its detail beside it.
 */
@component('mitra-routine-row')
export class RoutineRow extends Component {
	@property({ type: Object }) routine?: Routine
	@state() open = false

	readonly store = new EntryStore(this)

	/** The entry today's tick changes: the store's, claimed for this date before a press reaches the checkbox. */
	@state() private claimed?: Entry

	/** The status control's entry: the store's occurrence of today, else today's own, whose tick completes it through the API. */
	private get tickEntry() {
		const today = RoutineStore.onToday(this.routine!)!
		return this.claimed ?? RoutineStore.occurrenceOf(today)?.entry ?? today.entry
	}

	private readonly claim = () => {
		const today = this.routine && RoutineStore.onToday(this.routine)
		const occurrence = today && RoutineStore.occurrenceOf(today)
		this.claimed = occurrence && EntryStore.editable(occurrence)
	}

	private readonly handleTick = async () => {
		const entry = this.claimed
		this.claimed = undefined
		if (entry) {
			EntryStore.notify()
			await EntryStore.commit(entry).catch(reportSaveError)
			await RoutineStore.refresh()
		} else {
			await RoutineStore.completeToday(this.routine!)
		}
	}

	@eventListener('click')
	protected handleClick(e: MouseEvent) {
		if ((e.target as HTMLElement).closest('mitra-entry-status, mitra-routine-details')) {
			return
		}
		this.open = !this.open
	}

	static override get styles() {
		return css`
			mitra-routine-row {
				display: grid;
				grid-template-columns: minmax(0, 1fr) auto;
				grid-template-areas:
					'name tick'
					'when flame';
				align-items: center;
				column-gap: 0.5rem;
				padding: 0.4rem 0.5rem 0.45rem 0.6rem;
				border-radius: var(--border-radius);
				border-inline-start: 3px solid var(--mitra-entry-segment-color);
				background: color-mix(in srgb, var(--mitra-entry-segment-color) 18%, var(--color-background));
				color: color-mix(in srgb, var(--mitra-entry-segment-color) 45%, var(--color-text));
				font-size: 0.75rem;
				cursor: pointer;
				user-select: none;
				anchor-name: --mitra-routine-details;
				anchor-scope: --mitra-routine-details;

				/* Today's checkbox is taller than the name's line; the rows part a little, so it and the flame below don't touch. */
				&:has(> mitra-entry-status) {
					row-gap: 0.3rem;
				}

				&:hover {
					background: color-mix(in srgb, var(--mitra-entry-segment-color) 25%, var(--color-background));
				}

				/* Open, it is filled in its calendar's colour with ink that reads on it, as an entry is while its editor is open. */
				&[data-open] {
					background: var(--mitra-entry-segment-color);
					${contrastColorOf('color', 'var(--mitra-entry-segment-color)')};

					> .when {
						color: color-mix(in srgb, currentColor 75%, transparent);
					}

					> mitra-routine-flame {
						color: inherit;

						> mitra-icon {
							color: currentColor;
							--mitra-icon-fill: color-mix(in srgb, currentColor 25%, transparent);
						}
					}
				}

				> .name {
					grid-area: name;
					font-weight: 600;
					font-size: 0.8125rem;
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
				}

				/* The rule wraps where it is long, the time kept with its last word. */
				> .when {
					grid-area: when;
					min-inline-size: 0;
					color: color-mix(in srgb, var(--mitra-entry-segment-color) 30%, var(--color-text-muted));
					text-wrap: pretty;
				}

				> mitra-entry-status, > .time {
					grid-area: tick;
					align-self: start;
					justify-self: end;
				}

				> mitra-entry-status {
					inline-size: 1.125rem;
					block-size: 1.125rem;

					> button {
						font-size: 1.125rem;
					}
				}

				> .time {
					font-weight: 500;
					white-space: nowrap;
					opacity: 0.8;
				}

				/* Level with the rule's last line, however many it wraps to. */
				> mitra-routine-flame {
					grid-area: flame;
					align-self: end;
					justify-self: end;
				}
			}
		`
	}

	protected override createRenderRoot() { return this }

	protected override updated() {
		this.toggleAttribute('data-open', this.open)
		this.style.setProperty('--mitra-entry-segment-color', String(Calendars.getSource(this.routine?.sourceId ?? '')?.color ?? ''))
	}

	protected override get template() {
		const routine = this.routine
		const dates = routine && RoutineStore.datesOf(routine)
		if (!routine || !dates) {
			return html.nothing
		}
		const rule = RoutineStore.ruleOf(routine)
		const { next } = dates
		const time = RoutineStore.timeOf(routine)
		// Today's status where it can be changed: a task's whatever became of it, an event's once it was called off.
		const today = RoutineStore.onToday(routine)
		const changeable = !!today && (RoutineStore.isTask(routine) ? RoutineStore.ticks(routine) : today.entry.cancelled && RoutineStore.cancels(routine))
		return html`
			<span class="name" title=${routine.label}>${routine.label}</span>
			<span class="when">
				<span class="rule">${routine.frequency(rule, next?.start)}</span>${!time ? html.nothing : html`<span class="at">&nbsp;·&nbsp;${time}</span>`}
			</span>
			${!today ? html.nothing : changeable ? html`
				<mitra-entry-status .entry=${this.tickEntry} @pointerdown=${this.claim} @keydown=${this.claim} @change=${this.handleTick}></mitra-entry-status>
			` : RoutineStore.isTask(routine) ? html.nothing : html`<span class="time">${time ?? ''}</span>`}
			<mitra-routine-flame .routine=${routine}></mitra-routine-flame>
			${!this.open ? html.nothing : html`
				<mitra-routine-details .routine=${routine} @close=${() => this.open = false}></mitra-routine-details>
			`}
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-routine-row': RoutineRow
	}
}
