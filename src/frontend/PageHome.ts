import { component, html, state, css, eventListener } from '@a11d/lit'
import { PageComponent, route } from '@a11d/lit-application'
import { DateTime } from '@3mo/date-time'
import { sampleEvents } from 'shared'

@component('mitra-page-calendar')
@route('/')
export class PageHome extends PageComponent {
	@state() navigatingDate = new DateTime()
	@state() view: 'week' | 'month' = 'week'

	private setView(value: 'week' | 'month') {
		if (this.view === value) {
			return
		}

		const transition = (fn: () => Promise<void>) => !document.startViewTransition ? fn() : document.startViewTransition(fn)

		transition(async () => {
			this.view = value
			await new Promise(resolve => setTimeout(resolve, 100))
		})
	}


	@eventListener({ target: window, type: 'keydown' })
	protected handleKeyDown(e: KeyboardEvent) {
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
			return
		}

		switch (e.key.toLowerCase()) {
			case 'w':
				this.setView('week')
				break
			case 'm':
				this.setView('month')
				break
			case 't':
				this.navigatingDate = new DateTime()
				break
			default:
				break
		}
	}

	static override get styles() {
		return css`
			mitra-page-calendar {
				padding: 0 !important;
				background-color: var(--color-background);
				color: var(--color-text);
				font-family: 'Inter', sans-serif;
				display: flex;
				flex-direction: column;
				position: absolute;
				inset: 0;
				overflow: hidden;

				h1 {
					border-bottom: var(--border);
					padding: 1.25rem 1.25rem 0.625rem;
					margin: 0;
					font-size: 1.5rem;
					font-weight: 500;
				}

				mitra-month, mitra-days {
					flex: 1;
					min-height: 0;
				}
			}
		`
	}

	protected override createRenderRoot() { return this }

	protected override get template() {
		return html`
			<h1>${this.navigatingDate.format({ month: 'long', year: 'numeric' })}</h1>
			${this.view === 'week' ? html`
				<mitra-days
					.events=${sampleEvents}
					.navigatingDate=${this.navigatingDate}
					@navigate=${(e: CustomEvent<DateTime>) => this.navigatingDate = e.detail}
				></mitra-days>
			` : html`
				<mitra-month
					.events=${sampleEvents}
					.navigatingDate=${this.navigatingDate}
					@navigate=${(e: CustomEvent<DateTime>) => this.navigatingDate = e.detail}
					@switchToWeek=${() => this.setView('week')}
				></mitra-month>
			`}
		`
	}
}