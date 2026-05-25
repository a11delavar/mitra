import { component, html, state, css, eventListener } from '@a11d/lit'
import { PageComponent, route } from '@a11d/lit-application'
import { Task } from '@lit/task'
import { DateTime } from '@3mo/date-time'
import { fetchEvents } from './Api.js'

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
			await this.updateComplete
			await Promise.all([...this.renderRoot.querySelectorAll('mitra-event-segment')].map(e => e.updateComplete))
		})
	}


	private readonly fetchTask = new Task(this, {
		args: () => [this.navigatingDate.month, this.navigatingDate.year] as const,
		task: () => {
			const start = this.navigatingDate.monthStart.subtract({ months: 1 })
			const end = this.navigatingDate.monthEnd.add({ months: 1 })
			return fetchEvents(start, end)
		}
	})

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
					padding: 0.75rem 1.25rem;
					margin: 0;
					font-size: 1.375rem;
					font-weight: 600;
					letter-spacing: -0.01em;
					color: var(--color-text);
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
		const entries = this.fetchTask.value || []
		return html`
			<h1>${this.navigatingDate.format({ month: 'long', year: 'numeric' })}</h1>
			${this.view === 'week' ? html`
				<mitra-days
					.entries=${entries}
					.navigatingDate=${this.navigatingDate}
					@navigate=${(e: CustomEvent<DateTime>) => this.navigatingDate = e.detail}
				></mitra-days>
			` : html`
				<mitra-month
					.entries=${entries}
					.navigatingDate=${this.navigatingDate}
					@navigate=${(e: CustomEvent<DateTime>) => this.navigatingDate = e.detail}
					@switchToWeek=${() => this.setView('week')}
				></mitra-month>
			`}
		`
	}
}