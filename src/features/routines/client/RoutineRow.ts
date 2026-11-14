import { Component, component, css, eventListener, html, property, state } from '@a11d/lit'
import { devicePixel } from '#design'
import { Calendars } from '#features/sources/client/Calendars.js'
import type { Entry } from '#features/entries'
import { EntryStore, reportSaveError } from '#features/entries/client/EntryStore.js'
import { type Routine } from '../Routine.js'
import { RoutineStore } from './RoutineStore.js'
import { cellStep } from './cellStep.css.js'
import './RoutineDetails.js'

/**
 * One routine in the sidebar's tab, a card in its calendar's colour: its name, how often it comes, today's tick for a task,
 * and a strip of its last occurrences with how many were kept. A click opens its detail beside it.
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
					'when tick'
					'strip ratio';
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

				&:hover {
					background: color-mix(in srgb, var(--mitra-entry-segment-color) 25%, var(--color-background));
				}

				&[data-open] {
					/* Inside the card, so the tab's scroller needs no room around it to show it. */
					outline: 2px solid var(--mitra-entry-segment-color);
					outline-offset: -2px;
				}

				> .name {
					grid-area: name;
					font-weight: 600;
					font-size: 0.8125rem;
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
				}

				/* The rule gives way before the time does. */
				> .when {
					grid-area: when;
					display: flex;
					min-inline-size: 0;
					color: color-mix(in srgb, var(--mitra-entry-segment-color) 30%, var(--color-text-muted));
					white-space: nowrap;

					> .rule {
						min-inline-size: 0;
						overflow: hidden;
						text-overflow: ellipsis;
					}

					> .at {
						flex: none;
					}
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

				> .strip {
					grid-area: strip;
					margin-block-start: 0.35rem;
					--gap: round(down, 2px, ${devicePixel});
					display: grid;
					/* The gap is each cell's own margin inside its step. */
					grid-template-columns: repeat(14, ${cellStep});
					justify-content: start;

					> .routine-cell {
						margin-inline-end: var(--gap);
					}
				}

				> .ratio {
					grid-area: ratio;
					margin-block-start: 0.35rem;
					font-weight: 500;
					font-variant-numeric: tabular-nums;
					white-space: nowrap;
					justify-self: end;
				}
			}

			/* One date: solid kept, hollow missed, a dash cancelled, ringed while today's is open, faint where there is none.
			   Square and never smaller than 8px, so it reads as a cell rather than a smudge. */
			.routine-cell {
				display: block;
				aspect-ratio: 1;
				/* Radius and ring in whole screen pixels too, or their edges fall between pixels and soften. */
				--ring: round(1.5px, ${devicePixel});
				border-radius: round(2px, ${devicePixel});
				background: var(--mitra-entry-segment-color);

				&[data-state=missed] {
					background: none;
					box-shadow: inset 0 0 0 var(--ring) color-mix(in srgb, var(--mitra-entry-segment-color) 70%, transparent);
				}

				&[data-state=cancelled] {
					position: relative;
					background: none;

					&::after {
						content: '';
						position: absolute;
						inset: 40% 15%;
						border-radius: 1px;
						background: color-mix(in srgb, var(--mitra-entry-segment-color) 60%, transparent);
					}
				}

				&[data-state=open] {
					background: color-mix(in srgb, var(--mitra-entry-segment-color) 25%, transparent);
					box-shadow: inset 0 0 0 var(--ring) var(--mitra-entry-segment-color);
				}

				&[data-state=upcoming] {
					background: color-mix(in srgb, var(--mitra-entry-segment-color) 12%, transparent);
				}

				&[data-state=none] {
					background: color-mix(in srgb, var(--mitra-entry-segment-color) 10%, transparent);
				}

				&[data-state=future] {
					visibility: hidden;
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
		const { strip } = RoutineStore
		const last = dates.last(strip)
		const cells = [...Array.from({ length: strip - last.length }, () => 'none'), ...last.map(date => String(dates.statusOf(date)))]
		const rule = RoutineStore.ruleOf(routine)
		const { next } = dates
		const time = RoutineStore.timeOf(routine)
		const kept = dates.kept(strip)
		const of = dates.settled(strip)
		// Today's status where it can be changed: a task's whatever became of it, an event's once it was called off.
		const today = RoutineStore.onToday(routine)
		const changeable = !!today && (RoutineStore.isTask(routine) ? RoutineStore.ticks(routine) : today.entry.cancelled && RoutineStore.cancels(routine))
		return html`
			<span class="name" title=${routine.label}>${routine.label}</span>
			<span class="when">
				<span class="rule">${routine.frequency(rule, next?.start)}</span>
				${!time ? html.nothing : html`<span class="at">&nbsp;· ${time}</span>`}
			</span>
			${!today ? html.nothing : changeable ? html`
				<mitra-entry-status .entry=${this.tickEntry} @pointerdown=${this.claim} @keydown=${this.claim} @change=${this.handleTick}></mitra-entry-status>
			` : RoutineStore.isTask(routine) ? html.nothing : html`<span class="time">${time ?? ''}</span>`}
			<span class="strip">${cells.map(status => html`<i class="routine-cell" data-state=${status}></i>`)}</span>
			<span class="ratio" title=${t('${count:number} of ${total:number} kept', { count: kept, total: of })}>
				${t('${count:number} of ${total:number}', { count: kept, total: of })}
			</span>
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
