import { Component, component, css, html, repeat } from '@a11d/lit'
import { Calendars } from '#features/sources/client/Calendars.js'
import { RoutineStore, type RoutineSection } from './RoutineStore.js'
import './RoutineRow.js'

/**
 * The sidebar's Routines tab: what the person keeps up, one row per routine of the visible calendars, those with a date
 * today first. At its end, folded away, what the person said is no routine, to make one a routine again.
 */
@component('mitra-routines')
export class RoutinesTab extends Component {
	readonly store = new RoutineStore(this)

	private static headingOf(section: RoutineSection) {
		switch (section) {
			case 'today': return t('Today')
			case 'ongoing': return t('Ongoing')
			case 'past': return t('Past')
		}
	}

	static override get styles() {
		return css`
			mitra-routines {
				display: flex;
				flex-direction: column;
				gap: 1rem;
				min-block-size: 0;
				overflow-y: auto;

				> section {
					display: flex;
					flex-direction: column;
					gap: 0.35rem;

					> h2 {
						margin: 0;
						font-size: 0.75rem;
						font-weight: 600;
						color: var(--color-text-muted);
					}
				}

				/* Folded by default: a correction made once, looked at rarely. Its summary reads as a section heading. */
				> details {
					interpolate-size: allow-keywords;

					> summary {
						display: flex;
						align-items: center;
						gap: 0.25rem;
						list-style: none;
						cursor: pointer;
						font-size: 0.75rem;
						font-weight: 600;
						color: var(--color-text-muted);

						&::-webkit-details-marker {
							display: none;
						}

						> mitra-icon {
							font-size: 0.875rem;
							transition: rotate 0.15s;

							&:dir(rtl) {
								scale: -1 1;
							}
						}

						> .count {
							margin-inline-start: auto;
							font-variant-numeric: tabular-nums;
						}
					}

					&[open] > summary > mitra-icon {
						rotate: 90deg;
					}

					&::details-content {
						block-size: 0;
						opacity: 0;
						overflow: clip;
						overflow-clip-margin: 0.5rem;
					}

					&[open]::details-content {
						block-size: auto;
						opacity: 1;
					}

					@media (prefers-reduced-motion: no-preference) {
						&::details-content {
							transition:
								block-size 0.3s cubic-bezier(0.1, 0.9, 0.2, 1),
								opacity 0.2s ease,
								content-visibility 0.3s allow-discrete;
						}
					}

					/* What came long ago and comes no more, folded: its rows as the sections above lay theirs. */
					/* Margins, not a flex gap: a details element lays what it folds in a box of its own, which a gap treats as one item. */
					&.past {
						> summary {
							margin-block-end: 0.35rem;
						}

						> mitra-routine-row + mitra-routine-row {
							margin-block-start: 0.35rem;
						}
					}

					> ul {
						display: flex;
						flex-direction: column;
						gap: 0.25rem;
						margin: 0.35rem 0 0;
						padding: 0;
						list-style: none;

						> li {
							display: flex;
							align-items: center;
							gap: 0.25rem;
							padding: 0.15rem 0.25rem 0.15rem 0.6rem;
							border-radius: var(--border-radius);
							border-inline-start: 3px solid var(--mitra-entry-segment-color);
							background: color-mix(in srgb, var(--mitra-entry-segment-color) 10%, var(--color-background));
							color: color-mix(in srgb, var(--mitra-entry-segment-color) 45%, var(--color-text));
							font-size: 0.8125rem;
							font-weight: 500;

							> .name {
								flex: 1;
								min-inline-size: 0;
								overflow: hidden;
								text-overflow: ellipsis;
								white-space: nowrap;
							}
						}
					}
				}

				> .empty {
					flex: 1;
					display: flex;
					flex-direction: column;
					align-items: center;
					justify-content: center;
					gap: 0.5rem;
					padding: 1.5rem 1rem;
					text-align: center;
					color: var(--color-text-muted);
					font-size: 0.8rem;
					line-height: 1.4;

					> mitra-icon {
						font-size: 1.5rem;
						opacity: 0.5;
					}
				}
			}
		`
	}

	/** Opened at the end of a long list, it shows what it holds rather than unfolding out of sight. */
	private static async handleDissolvedToggle(e: Event) {
		const details = e.currentTarget as HTMLDetailsElement
		if (details.open) {
			// After it has unfolded: measured mid-way, it would scroll to a fraction of what it holds.
			await Promise.allSettled(details.getAnimations({ subtree: true }).map(animation => animation.finished))
			details.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
		}
	}

	protected override createRenderRoot() { return this }

	protected override get template() {
		const sections = RoutineStore.sections
		const dissolved = RoutineStore.visibleDissolved
		return !RoutineStore.loaded ? html.nothing : html`
			${!sections.length ? html`
				<div class="empty">
					<mitra-icon icon="activity"></mitra-icon>
					<span>${t('What you keep doing shows up here: an entry that repeats, or four entries with one title.')}</span>
				</div>
			` : sections.map(({ section, routines }) => section === 'past' ? html`
				<details class="past" @toggle=${RoutinesTab.handleDissolvedToggle}>
					<summary>
						<mitra-icon icon="chevron-right"></mitra-icon>
						${RoutinesTab.headingOf(section)}
						<span class="count">${routines.length.format()}</span>
					</summary>
					${repeat(routines, routine => routine.id, routine => html`<mitra-routine-row .routine=${routine}></mitra-routine-row>`)}
				</details>
			` : html`
				<section>
					<h2>${RoutinesTab.headingOf(section)}</h2>
					${repeat(routines, routine => routine.id, routine => html`<mitra-routine-row .routine=${routine}></mitra-routine-row>`)}
				</section>
			`)}
			${!dissolved.length ? html.nothing : html`
				<details @toggle=${RoutinesTab.handleDissolvedToggle}>
					<summary>
						<mitra-icon icon="chevron-right"></mitra-icon>
						${t('Not routines')}
						<span class="count">${dissolved.length}</span>
					</summary>
					<ul>
						${repeat(dissolved, routine => routine.id, routine => html`
							<li style="--mitra-entry-segment-color: ${Calendars.getSource(routine.sourceId)?.color ?? ''}">
								<span class="name" title=${routine.label}>${routine.label}</span>
								<mitra-icon-button icon="undo-2" label=${t('Make it a routine again')} @click=${() => RoutineStore.restore(routine)}></mitra-icon-button>
							</li>
						`)}
					</ul>
				</details>
			`}
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-routines': RoutinesTab
	}
}
