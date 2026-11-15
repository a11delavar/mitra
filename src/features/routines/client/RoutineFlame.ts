import { Component, component, css, html, property } from '@a11d/lit'
import { Calendars } from '#features/sources/client/Calendars.js'
import { type Routine } from '../Routine.js'
import { RoutineStore } from './RoutineStore.js'

/**
 * A routine's streak at a glance, wherever its name is: a flame in its calendar's colour and how many dates it kept in a row,
 * a grey flame alone once the last was missed, nothing for one untracked, before one settled or where the tab has not
 * read its dates.
 */
@component('mitra-routine-flame')
export class RoutineFlame extends Component {
	@property({ type: Object }) routine?: Routine

	readonly routines = new RoutineStore(this)

	/** Its streak, of a routine tracked: one its person keeps to as a schedule shows none. */
	private get streak() {
		return !this.routine?.tracked ? undefined : RoutineStore.datesOf(this.routine)?.streaks.at(-1)
	}

	static override get styles() {
		return css`
			/* The count hugs its flame and wears its colour, so the two read as one mark. */
			mitra-routine-flame {
				display: inline-flex;
				align-items: center;
				gap: 1px;
				font-weight: 650;
				font-variant-numeric: tabular-nums;
				line-height: 1;
				white-space: nowrap;
				color: color-mix(in srgb, var(--mitra-entry-segment-color) 60%, var(--color-text));

				> mitra-icon {
					font-size: 0.9rem;
					color: var(--mitra-entry-segment-color);
					--mitra-icon-fill: color-mix(in srgb, var(--mitra-entry-segment-color) 30%, transparent);
				}

				/* Trimmed to its digits' height and centred on the flame's round base, where its weight is, not on its thin tip. */
				> .count {
					text-box: trim-both cap alphabetic;
					translate: 0 0.075rem;
				}

				&[data-out] > mitra-icon {
					color: var(--color-text-muted);
					--mitra-icon-fill: none;
					opacity: 0.7;
				}
			}
		`
	}

	protected override createRenderRoot() { return this }

	protected override updated() {
		const streak = this.streak
		this.toggleAttribute('data-out', !!streak?.out)
		this.title = !streak ? '' : String(streak.out ? t('The streak ended') : t('${count:number} in a row', { count: streak.length }))
		this.style.setProperty('--mitra-entry-segment-color', String(Calendars.getSource(this.routine?.sourceId ?? '')?.color ?? ''))
	}

	protected override get template() {
		const streak = this.streak
		// An ended routine's streak is a record, under a flag, not a flame still burning.
		return !streak ? html.nothing : html`
			<mitra-icon icon=${this.routine && RoutineStore.ended(this.routine) ? 'flag' : 'flame'}></mitra-icon>
			${streak.out ? html.nothing : html`<span class="count">${streak.length}</span>`}
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-routine-flame': RoutineFlame
	}
}
