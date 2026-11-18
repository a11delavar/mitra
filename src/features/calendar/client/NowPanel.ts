import { Component, component, html, css, event, repeat, styleMap } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { scrollbar } from '#design'
import type { EntryOccurrence } from '#features/recurrence'
import { EntryStore } from '#features/entries/client/EntryStore.js'
import { EntryEditorIntent } from '#features/entries/client/EntryEditorIntent.js'

const minute = 60_000

/**
 * A live column beside the calendar on wide screens: what is happening now, how far along it is, and what comes
 * next. It reads the occurrences the page already shows, so an edit anywhere shows here at once; the page fetches at
 * least the month around the navigated date, which on the desktop is almost always the month of today.
 */
@component('mitra-now-panel')
export class NowPanel extends Component {
	/** The page navigates to the entry before its editor is asked to open, as the command palette does. */
	@event() readonly navigate!: EventDispatcher<DateTime>

	readonly store = new EntryStore(this)

	private tick?: ReturnType<typeof setInterval>

	protected override connected() {
		super.connected()
		this.tick = setInterval(() => this.requestUpdate(), 1000)
	}

	protected override disconnected() {
		super.disconnected()
		clearInterval(this.tick)
	}

	protected override createRenderRoot() { return this }

	/** The panel renders every second; building `Intl` formatters is slow in Safari, so each is made once per locale. */
	private static readonly formatters = new Map<string, unknown>()

	private formatter<T>(kind: string, create: () => T): T {
		const key = `${String(this.locale)}|${kind}`
		if (!NowPanel.formatters.has(key)) {
			NowPanel.formatters.set(key, create())
		}
		return NowPanel.formatters.get(key) as T
	}

	/** The clock as the locale writes it, with the seconds (and the separator leading to them) set apart to tick. */
	private clockTemplate(now: DateTime) {
		const parts = this.formatter(`clock|${now.timeZone}`, () => new Intl.DateTimeFormat(this.locale, { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: now.timeZone })).formatToParts(now)
		return parts.map((part, index) => part.type === 'second' || (part.type === 'literal' && parts[index + 1]?.type === 'second')
			? html`<span class="seconds">${part.value}</span>`
			: part.type === 'dayPeriod' ? html`<span class="period">${part.value}</span>` : part.value)
	}

	private get locale() {
		return Localizer.locales.current
	}

	/** Timed occurrences only: all-day ones have no "now", availability is a window rather than something to attend. */
	private get timed() {
		return EntryStore.shown
			.filter(occurrence => occurrence.start && occurrence.end && !occurrence.allDay && !occurrence.entry.type.isAvailability && !occurrence.entry.closed && occurrence.entry.heading.trim())
			.toSorted((a, b) => a.start!.valueOf() - b.start!.valueOf() || a.end!.valueOf() - b.end!.valueOf())
	}

	private relative(milliseconds: number) {
		const format = this.formatter('relative', () => new Intl.RelativeTimeFormat(this.locale, { numeric: 'auto', style: 'long' }))
		const minutes = milliseconds / minute
		if (Math.abs(minutes) < 1) {
			return format.format(Math.round(milliseconds / 1000), 'second')
		}
		if (Math.abs(minutes) < 120) {
			return format.format(Math.round(minutes), 'minute')
		}
		const hours = minutes / 60
		if (Math.abs(hours) < 36) {
			return format.format(Math.round(hours * 2) / 2, 'hour')
		}
		return format.format(Math.round(hours / 24), 'day')
	}

	private duration(milliseconds: number) {
		const total = Math.max(1, Math.ceil(milliseconds / minute))
		const hours = Math.floor(total / 60)
		const minutes = total % 60
		return this.formatter('duration', () => new Intl.DurationFormat(this.locale, { style: 'short' })).format(hours ? { hours, minutes } : { minutes })
	}

	private time(date: DateTime) {
		return date.format({ hour: '2-digit', minute: '2-digit' })
	}

	/** The time of day, prefixed by the day when it is not today. */
	private when(date: DateTime, now: DateTime) {
		const days = Math.round((date.dayStart.valueOf() - now.dayStart.valueOf()) / (24 * 60 * minute))
		if (days === 0) {
			return this.time(date)
		}
		const day = days === 1 ? t('Tomorrow') : date.format({ weekday: 'short', day: 'numeric', month: 'short' })
		return `${day} · ${this.time(date)}`
	}

	private colorOf(occurrence: EntryOccurrence) {
		return { '--mitra-entry-segment-color': String(occurrence.entry.effectiveColor ?? 'var(--color-accent)') }
	}

	private open(occurrence: EntryOccurrence) {
		this.navigate.dispatch(occurrence.start!)
		if (occurrence.key) {
			EntryEditorIntent.requestOpen(occurrence.key)
		}
	}

	protected override get template() {
		const now = new DateTime()
		const instant = now.valueOf()
		const timed = this.timed
		const current = timed.filter(occurrence => occurrence.start!.valueOf() <= instant && instant < occurrence.end!.valueOf())
		const upcoming = timed.filter(occurrence => occurrence.start!.valueOf() > instant)
		const [next, ...rest] = upcoming
		const later = rest.filter(occurrence => occurrence.start!.dayStart.equals(now.dayStart)).slice(0, 4)
		return html`
			<header class="clock">
				<time class="time" datetime=${now.toISOString()}>${this.clockTemplate(now)}</time>
				<span class="date">${now.format({ weekday: 'long', day: 'numeric', month: 'long' })}</span>
			</header>

			<section class="current" ?data-busy=${current.length > 0}>
				<h2 class="label"><span class="pulse"></span>${t('Happening now')}</h2>
				${current.length ? repeat(current, occurrence => occurrence.key, occurrence => this.currentTemplate(occurrence, instant)) : html`
					<div class="idle">
						<span class="orb"></span>
						<strong>${t('Free time')}</strong>
						<span class="detail">${next && next.start!.dayStart.equals(now.dayStart) ? t('Free until ${time}', { time: this.time(next.start!) }) : t('Nothing else today')}</span>
					</div>
				`}
			</section>

			<section class="next">
				<h2 class="label">${t('Up next')}</h2>
				${!next ? html`<p class="empty">${t('Nothing else coming up')}</p>` : html`
					<button class="entry" style=${styleMap(this.colorOf(next))} ?data-imminent=${next.start!.valueOf() - instant <= 5 * minute}
						@click=${() => this.open(next)}
					>
						<span class="heading">${next.entry.heading}</span>
						<span class="countdown">${this.relative(next.start!.valueOf() - instant)}</span>
						<span class="range">${this.when(next.start!, now)} – ${this.time(next.end!)}${next.entry.location ? html` · ${next.entry.location}` : html.nothing}</span>
					</button>
				`}
			</section>

			${!later.length ? html.nothing : html`
				<section class="later">
					<h2 class="label">${t('Later today')}</h2>
					<ol>
						${repeat(later, occurrence => occurrence.key, occurrence => html`
							<li>
								<button class="entry" style=${styleMap(this.colorOf(occurrence))} @click=${() => this.open(occurrence)}>
									<span class="start">${this.time(occurrence.start!)}</span>
									<span class="heading">${occurrence.entry.heading}</span>
								</button>
							</li>
						`)}
					</ol>
				</section>
			`}
		`
	}

	private currentTemplate(occurrence: EntryOccurrence, instant: number) {
		const start = occurrence.start!.valueOf()
		const end = occurrence.end!.valueOf()
		const progress = Math.min(1, Math.max(0, (instant - start) / Math.max(1, end - start)))
		return html`
			<button class="entry" style=${styleMap({ ...this.colorOf(occurrence), '--progress': String(progress) })} @click=${() => this.open(occurrence)}>
				<span class="heading">${occurrence.entry.heading}</span>
				<span class="since">${t('Started ${when}', { when: this.relative(start - instant) })}</span>
				<span class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${Math.round(progress * 100)}><span class="fill"></span></span>
				<span class="range">
					<span>${this.time(occurrence.start!)} – ${this.time(occurrence.end!)}</span>
					<span class="left">${t('${duration} left', { duration: this.duration(end - instant) })}</span>
				</span>
			</button>
		`
	}

	static override get styles() {
		return css`
			mitra-now-panel {
				display: flex;
				flex-direction: column;
				gap: 1.25rem;
				box-sizing: border-box;
				inline-size: 18rem;
				flex: none;
				padding: 1rem 1rem 1.25rem;
				border-inline-start: 1px solid var(--color-border);
				background-color: var(--color-background);
				color: var(--color-text);
				font-family: var(--font-family);
				overflow-y: auto;
				${scrollbar};

				&[hidden] {
					display: none;
				}

				@media (max-width: 1199px) {
					display: none;
				}

				.clock {
					display: flex;
					flex-direction: column;
					gap: 0.125rem;
					padding-block: 0.25rem 0.5rem;

					.time {
						font-variant-numeric: tabular-nums;
						line-height: 1;
						font-size: 2.5rem;
						font-weight: 700;
						letter-spacing: -0.03em;
						white-space: nowrap;

						.seconds, .period {
							font-size: 1rem;
							font-weight: 600;
							letter-spacing: 0;
						}

						.seconds {
							color: var(--color-accent);
							animation: mitra-now-tick 1s steps(1) infinite;
						}

						.period {
							margin-inline-start: 0.25rem;
							color: var(--color-text-muted);
						}
					}

					.date {
						font-size: 0.8125rem;
						color: var(--color-text-muted);

						&::first-letter {
							text-transform: uppercase;
						}
					}
				}

				.label {
					display: flex;
					align-items: center;
					gap: 0.5rem;
					margin: 0 0 0.5rem;
					font-size: 0.6875rem;
					font-weight: 700;
					letter-spacing: 0.08em;
					text-transform: uppercase;
					color: var(--color-text-muted);
				}

				.entry {
					all: unset;
					box-sizing: border-box;
					position: relative;
					display: flex;
					flex-direction: column;
					gap: 0.375rem;
					inline-size: 100%;
					padding: 0.75rem 0.875rem;
					border-radius: calc(2 * var(--border-radius));
					border-inline-start: 0.25rem solid var(--mitra-entry-segment-color);
					background-color: color-mix(in srgb, var(--mitra-entry-segment-color) 14%, var(--color-background));
					cursor: pointer;
					animation: mitra-now-enter 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both;
					transition: background-color 0.2s ease, translate 0.2s ease;

					&:hover {
						background-color: color-mix(in srgb, var(--mitra-entry-segment-color) 24%, var(--color-background));
						translate: 0 -1px;
					}

					&:focus-visible {
						outline: 2px solid var(--color-accent);
						outline-offset: 2px;
					}

					.heading {
						font-weight: 650;
						line-height: 1.25;
						overflow-wrap: anywhere;
					}

					.since, .countdown, .range {
						font-size: 0.8125rem;
						color: var(--color-text-muted);
						font-variant-numeric: tabular-nums;
					}
				}

				.current {
					display: flex;
					flex-direction: column;
					gap: 0.5rem;

					.label {
						color: var(--color-text);

						.pulse {
							position: relative;
							inline-size: 0.5rem;
							block-size: 0.5rem;
							border-radius: 50%;
							background-color: var(--color-text-muted);

							&::after {
								content: '';
								position: absolute;
								inset: 0;
								border-radius: inherit;
								background-color: inherit;
							}
						}
					}

					&[data-busy] .label .pulse {
						background-color: #ef4444;

						&::after {
							animation: mitra-now-ripple 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
						}
					}

					.entry {
						gap: 0.5rem;

						.heading {
							font-size: 1.125rem;
						}

						.since {
							color: color-mix(in srgb, var(--mitra-entry-segment-color) 55%, var(--color-text));
							font-weight: 600;
						}
					}

					.progress {
						position: relative;
						display: block;
						block-size: 0.375rem;
						border-radius: 1rem;
						overflow: hidden;
						background-color: color-mix(in srgb, var(--mitra-entry-segment-color) 20%, transparent);

						/* Scaled rather than sized: it moves every second, and a width transition reflowed the page all the while (Safari stuttered). */
						.fill {
							position: absolute;
							inset: 0;
							border-radius: inherit;
							background-color: var(--mitra-entry-segment-color);
							scale: var(--progress) 1;
							transform-origin: 0 50%;
							transition: scale 1s linear;
							overflow: hidden;

							&:dir(rtl) {
								transform-origin: 100% 50%;
							}

							&::after {
								content: '';
								position: absolute;
								inset: 0;
								background: linear-gradient(90deg, transparent, color-mix(in srgb, white 55%, transparent), transparent);
								translate: -100% 0;
								animation: mitra-now-shimmer 2.4s ease-in-out infinite;
							}
						}
					}

					.range {
						display: flex;
						justify-content: space-between;
						gap: 0.5rem;

						.left {
							font-weight: 600;
							color: var(--color-text);
						}
					}

					.idle {
						display: grid;
						grid-template-columns: auto 1fr;
						column-gap: 0.75rem;
						align-items: center;
						padding: 0.875rem;
						border-radius: calc(2 * var(--border-radius));
						background-color: var(--color-surface);
						animation: mitra-now-enter 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both;

						.orb {
							grid-row: span 2;
							inline-size: 1.75rem;
							block-size: 1.75rem;
							border-radius: 50%;
							background: radial-gradient(circle at 35% 35%, color-mix(in srgb, var(--color-accent) 35%, white), var(--color-accent));
							animation: mitra-now-breathe 4s ease-in-out infinite;
						}

						.detail {
							font-size: 0.8125rem;
							color: var(--color-text-muted);
						}
					}
				}

				.next .entry {
					.countdown {
						font-size: 1rem;
						font-weight: 650;
						color: color-mix(in srgb, var(--mitra-entry-segment-color) 55%, var(--color-text));
					}

					/* A halo that only fades, so the compositor runs it: an animated shadow repainted every frame. */
					&[data-imminent]::after {
						content: '';
						position: absolute;
						inset: 0;
						border-radius: inherit;
						box-shadow: 0 0 0 0.375rem color-mix(in srgb, var(--mitra-entry-segment-color) 35%, transparent);
						pointer-events: none;
						opacity: 0;
						animation: mitra-now-glow 1.8s ease-in-out infinite;
					}
				}

				.empty {
					margin: 0;
					font-size: 0.8125rem;
					color: var(--color-text-muted);
				}

				.later ol {
					display: flex;
					flex-direction: column;
					gap: 0.25rem;
					margin: 0;
					padding: 0;
					list-style: none;

					.entry {
						flex-direction: row;
						align-items: baseline;
						gap: 0.625rem;
						padding: 0.375rem 0.625rem;
						border-inline-start-width: 0.1875rem;
						background-color: transparent;

						&:hover {
							background-color: color-mix(in srgb, var(--mitra-entry-segment-color) 12%, var(--color-background));
						}

						.start {
							font-size: 0.8125rem;
							font-variant-numeric: tabular-nums;
							color: var(--color-text-muted);
						}

						.heading {
							font-size: 0.875rem;
							font-weight: 500;
							white-space: nowrap;
							overflow: hidden;
							text-overflow: ellipsis;
						}
					}
				}

				@media (prefers-reduced-motion: reduce) {
					*, *::after {
						animation: none !important;
						transition: none !important;
					}
				}
			}

			@keyframes mitra-now-enter {
				from { opacity: 0; translate: 0 0.5rem; }
				to { opacity: 1; translate: 0 0; }
			}

			@keyframes mitra-now-ripple {
				from { scale: 1; opacity: 0.7; }
				to { scale: 3; opacity: 0; }
			}

			@keyframes mitra-now-shimmer {
				0% { translate: -100% 0; }
				60%, 100% { translate: 200% 0; }
			}

			@keyframes mitra-now-breathe {
				0%, 100% { scale: 0.85; opacity: 0.6; }
				50% { scale: 1; opacity: 1; }
			}

			@keyframes mitra-now-tick {
				0% { opacity: 1; }
				50% { opacity: 0.55; }
			}

			@keyframes mitra-now-glow {
				0%, 100% { opacity: 0; }
				50% { opacity: 1; }
			}
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-now-panel': NowPanel
	}
}
