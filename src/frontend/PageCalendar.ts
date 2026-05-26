import { component, html, state, css, eventListener, Controller, bind, queryAll } from '@a11d/lit'
import { PageComponent, route } from '@a11d/lit-application'
import { Task } from '@lit/task'
import { DateTime } from '@3mo/date-time'
import { MediaQueryController } from '@3mo/media-query-observer'
import { fetchEvents } from './Api.js'
import type { EventSegmentC } from './EventSegment.js'

class FetcherController extends Controller {
	private readonly eventSource = new EventSource('/api/events')

	constructor(override readonly host: PageCalendar) {
		super(host)
	}

	readonly task = new Task(this.host, {
		args: () => [this.host.navigatingDate.month, this.host.navigatingDate.year] as const,
		task: () => {
			const start = this.host.navigatingDate.monthStart.subtract({ months: 1 })
			const end = this.host.navigatingDate.monthEnd.add({ months: 1 })
			return fetchEvents(start, end)
		}
	})

	get value() {
		return this.task.value || []
	}

	override hostConnected() {
		this.task.run()
		this.eventSource.onmessage = (event) => {
			if (event.data === 'updated') {
				document.startViewTransition(async () => {
					await this.task.run()
					await this.host.updateComplete
					await Promise.all(this.host.eventSegments.map(e => e.updateComplete))
				})
			}
		}
	}

	override hostDisconnected() {
		this.eventSource?.close()
	}
}

@component('mitra-page-calendar')
@route('/')
export class PageCalendar extends PageComponent {
	@state() navigatingDate = new DateTime()
	@state() view: 'week' | 'month' = 'week'
	@state() sidebarOpen?: boolean

	readonly mediaController = new MediaQueryController(this, '(min-width: 800px)', matches => this.sidebarOpen = matches)

	@queryAll('mitra-event-segment') readonly eventSegments!: Array<EventSegmentC>

	private setView(value: 'week' | 'month') {
		if (this.view === value) {
			return
		}

		const transition = (fn: () => Promise<void>) => !document.startViewTransition ? fn() : document.startViewTransition(fn)

		transition(async () => {
			this.view = value
			await this.updateComplete
			await Promise.all(this.eventSegments.map(e => e.updateComplete))
		})
	}

	private readonly fetcher = new FetcherController(this)

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
			lit-page {
				display: contents;
			}

			mitra-page-calendar {
				padding: 0 !important;
				background-color: var(--color-background);
				color: var(--color-text);
				font-family: 'Inter', sans-serif;
				display: flex;
				flex-direction: row;
				position: absolute;
				inset: 0;
				overflow: hidden;

				main {
					display: flex;
					flex-direction: column;
					flex: 1;
					min-width: 0;
					min-height: 0;

					> header {
						display: flex;
						align-items: center;
						gap: 0.75rem;
						padding: 0.75rem 1.25rem;

						h1 {
							padding: 0;
							margin: 0;
							font-size: 1.375rem;
							font-weight: 600;
							letter-spacing: -0.01em;
							color: var(--color-text);
						}

						.toggle {
							cursor: pointer;
							color: var(--color-text-muted);
							transition: color 0.2s ease;
							font-size: 20px;
							display: flex;

							&:hover {
								color: var(--color-text);
							}
						}
					}

					mitra-month, mitra-days {
						flex: 1;
						min-height: 0;
					}
				}
			}
		`
	}

	protected override createRenderRoot() { return this }

	protected override get template() {
		const entries = this.fetcher.value
		return html`
			<lit-page heading='Mitra'>
				<mitra-sidebar ?open=${bind(this, 'sidebarOpen')}></mitra-sidebar>
				<main>
					<header>
						<mitra-icon class="toggle" icon="panel-left" @click=${() => this.sidebarOpen = !this.sidebarOpen}></mitra-icon>
						<h1>${this.navigatingDate.format({ month: 'long', year: 'numeric' })}</h1>
					</header>
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
				</main>
			</lit-page>
		`
	}
}