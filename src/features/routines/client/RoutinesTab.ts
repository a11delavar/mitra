import { Component, component, css, html, repeat } from '@a11d/lit'
import { RoutineStore, type RoutineSection } from './RoutineStore.js'
import './RoutineRow.js'

/**
 * The sidebar's Routines tab: what the person keeps up, one row per routine of the visible calendars, sectioned by how
 * often they come. It draws what `GET /routines?last=` answers; it is no list of the store's occurrences.
 */
@component('mitra-routines')
export class RoutinesTab extends Component {
	readonly store = new RoutineStore(this)

	private static headingOf(section: RoutineSection) {
		switch (section) {
			case 'today': return t('Today')
			case 'later': return t('Later')
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

	protected override createRenderRoot() { return this }

	protected override get template() {
		const sections = RoutineStore.sections
		return !RoutineStore.loaded ? html.nothing : !sections.length ? html`
			<div class="empty">
				<mitra-icon icon="repeat"></mitra-icon>
				<span>${t('What you keep doing shows up here: an entry that repeats, or four entries with one title.')}</span>
			</div>
		` : html`
			${sections.map(({ section, routines }) => html`
				<section>
					<h2>${RoutinesTab.headingOf(section)}</h2>
					${repeat(routines, routine => routine.id, routine => html`<mitra-routine-row .routine=${routine}></mitra-routine-row>`)}
				</section>
			`)}
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-routines': RoutinesTab
	}
}
