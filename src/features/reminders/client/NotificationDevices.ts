import { Component, component, html, css, state } from '@a11d/lit'
import { Task } from '@lit/task'
import { Api } from '@a11d/api'
import { type NotificationSubscription } from '../NotificationSubscription.js'
import { currentEndpoint, sendTestNotification, unregisterDevice } from './push.js'

/**
 * Registered notification devices panel with test push trigger and subscription revocation.
 */
@component('mitra-notification-devices')
export class NotificationDevices extends Component {
	@state() private tested = false

	/** The registered devices and which one is this browser — one load, since a row cannot be marked
	 * "this device" until both have arrived. Re-run by {@link forget}; a failure now reads as a failure
	 * instead of as an empty list. */
	private readonly devices = new Task(this, {
		args: () => [] as const,
		task: async () => ({
			endpoint: await currentEndpoint(),
			subscriptions: await Api.get<Array<NotificationSubscription>>('/push/subscriptions'),
		}),
	})

	protected override createRenderRoot() { return this }

	private readonly test = async () => {
		await sendTestNotification()
		this.tested = true
	}

	private readonly forget = async (endpoint: string) => {
		await unregisterDevice(endpoint)
		this.tested = false
		await this.devices.run()
	}

	/** Format relative time since device last seen. */
	private lastSeenLabel(value?: Date | string | null) {
		if (!value) {
			return t('never')
		}
		const hours = (Date.now() - new Date(value).getTime()) / 3_600_000
		const format = new Intl.RelativeTimeFormat(Localizer.languages.current, { numeric: 'auto' })
		return hours < 24 ? format.format(-Math.round(hours), 'hour') : format.format(-Math.round(hours / 24), 'day')
	}

	static override get styles() {
		return css`
			mitra-notification-devices {
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
				font-size: 0.8125rem;

				> header {
					display: flex;
					align-items: center;
					gap: 0.75rem;

					> h4 {
						margin: 0;
						font-size: 0.75rem;
						font-weight: 600;
						color: var(--color-text-muted);
					}

					> .sent {
						margin-inline-start: auto;
						font-size: 0.75rem;
						color: var(--color-text-muted);
					}

					> button {
						margin-inline-start: auto;

						.sent + & {
							margin-inline-start: 0;
						}
					}
				}

				/* Deliberately not named "empty": this renders inside the settings dialog's light DOM,
				   whose own .empty rule ("No matches") would centre it and pad it out. */
				> .note {
					margin: 0;
					color: var(--color-text-muted);
				}

				> ul {
					margin: 0;
					padding: 0;
					list-style: none;
					display: flex;
					flex-direction: column;

					> li {
						display: flex;
						align-items: center;
						gap: 0.5rem;
						padding-block: 0.375rem;
						border-block-start: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent);

						&:first-child {
							border-block-start: none;
						}

						> .name {
							flex: 1;
							min-inline-size: 0;
							overflow: hidden;
							white-space: nowrap;
							text-overflow: ellipsis;

							> .seen {
								margin-inline-start: 0.5rem;
								font-size: 0.75rem;
								color: var(--color-text-muted);
							}
						}

						> .here {
							flex-shrink: 0;
							font-size: 0.6875rem;
							padding: 0.125rem 0.375rem;
							border-radius: var(--border-radius);
							color: var(--color-text-muted);
							background: color-mix(in srgb, var(--color-text) 8%, transparent);
						}

						> mitra-icon-button {
							flex-shrink: 0;
							color: var(--color-text-muted);
							font-size: 0.8rem;
							margin-block: -0.25rem;
							opacity: 0;
							transition: opacity 0.15s ease;
						}

						&:hover > mitra-icon-button,
						> mitra-icon-button:focus-visible {
							opacity: 1;
						}
					}
				}
			}
		`
	}

	protected override get template() {
		return html`
			<header>
				<h4>${t('Devices')}</h4>
				${!this.tested ? html.nothing : html`<span class="sent">${t('Test notification sent.')}</span>`}
				<button @click=${this.test}>${t('Send test')}</button>
			</header>
			${this.devices.render({
				// Nothing while pending: the list sits in an already-visible settings row, and a spinner
				// that flashes for one local request reads as noise.
				pending: () => html.nothing,
				error: () => html`<p class="note">${t('Could not load your devices.')}</p>`,
				complete: ({ subscriptions, endpoint }) => !subscriptions.length
					? html`<p class="note">${t('No device is registered for reminders yet.')}</p>`
					: html`<ul>${subscriptions.map(device => this.getDeviceTemplate(device, endpoint))}</ul>`,
			})}
		`
	}

	private getDeviceTemplate(device: NotificationSubscription, endpoint?: string) {
		return html`
			<li>
				<span class="name">
					${device.timeZone || t('Unknown device')}
					<span class="seen">${t('last seen ${when}', { when: this.lastSeenLabel(device.lastSeenAt) })}</span>
				</span>
				${device.endpoint !== endpoint ? html.nothing : html`<span class="here">${t('this device')}</span>`}
				<mitra-icon-button icon="x" label=${t('Stop notifying this device')} @click=${() => this.forget(device.endpoint)}></mitra-icon-button>
			</li>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-notification-devices': NotificationDevices
	}
}
