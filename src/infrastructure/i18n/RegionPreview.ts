import { Component, component, css, html, property } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { Localizer } from '@3mo/localization'
import { TimeZone } from '../../features/time/TimeZone.js'

/**
 * What the regional format in force changes, read the way Mitra writes it: dates, times, the week, numbers, the
 * calendar and the names of time zones. Shown under the setting, since a region's differences (Austria's "Jänner",
 * Switzerland's "1'234.5") rarely show in one sample date.
 */
@component('mitra-region-preview')
export class RegionPreview extends Component {
	/** The tag in force, so a switch renders this again. */
	@property() locale = ''

	/** Zones whose names tell regions apart, shown beside the device's own, each with its city. */
	private static readonly zones = ['America/New_York', 'Europe/London', 'Europe/Berlin', 'Asia/Tokyo']

	protected override createRenderRoot() { return this }

	static override get styles() {
		return css`
			mitra-region-preview {
				display: block;

				> dl {
					display: grid;
					grid-template-columns: max-content minmax(0, 1fr);
					gap: 0.25rem 1rem;
					margin: 0;
					padding: 0.625rem 0.75rem;
					border-radius: 8px;
					background: color-mix(in srgb, var(--color-text) 4%, transparent);
					font-size: 0.75rem;

					> dt {
						color: var(--color-text-muted);
					}

					> dd {
						margin: 0;
						font-variant-numeric: tabular-nums;

						&.zones {
							display: flex;
							flex-wrap: wrap;
							column-gap: 0.75rem;

							.city {
								color: var(--color-text-muted);
							}
						}
					}
				}
			}
		`
	}

	protected override get template() {
		const locale = Localizer.locales.current
		const today = new DateTime()
		// January, where regions name the month differently ("Jänner"), at five past one, which tells the clocks apart.
		const sample = DateTime.from(Temporal.PlainDate.from({ year: new Date().getFullYear(), month: 1, day: 9 })
			.toZonedDateTime({ timeZone: today.timeZone, plainTime: '13:05' }).epochMilliseconds)
		const weekday = (dayOfWeek: number) => Temporal.PlainDate.from('2024-01-01').add({ days: dayOfWeek - 1 }).toLocaleString(String(locale), { weekday: 'long' })
		const week = locale.getWeekInfo()
		const zones = [...new Set([TimeZone.deviceId, ...RegionPreview.zones].map(id => TimeZone.of(id)))]
			.map(zone => zone.name(locale))
		return html`<dl>
				<dt>${t('Date')}</dt>
				<dd>${sample.format({ dateStyle: 'full' })} · ${sample.format({ year: 'numeric', month: '2-digit', day: '2-digit' })}</dd>
				<dt>${t('Time')}</dt>
				<dd>${sample.format({ timeStyle: 'short' })}</dd>
				<dt>${t('Week')}</dt>
				<dd>${t('${from} to ${to}', { from: weekday(week.firstDay), to: weekday((week.firstDay + 5) % 7 + 1) })}</dd>
				<dt>${t('Weekend')}</dt>
				<dd>${week.weekend.map(weekday).format()}</dd>
				<dt>${t('Numbers')}</dt>
				<dd>${(1234.5).format({ useGrouping: true })} · ${(67.5).formatAsPercent()}</dd>
				<dt>${t('Calendar')}</dt>
				<dd>${new Intl.DisplayNames([locale], { type: 'calendar' }).of(DateTime.getCalendar()) ?? ''}</dd>
				<dt>${t('Time zone names')}</dt>
				<dd class="zones">${zones.map(zone => html`<span><span class="city">${zone.city}</span> ${zone.short}</span>`)}</dd>
			</dl>`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-region-preview': RegionPreview
	}
}
