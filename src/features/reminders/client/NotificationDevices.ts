import { Component, component, html, css, state } from '@a11d/lit'
import { Task } from '@lit/task'
import { type NotificationSubscription } from '../NotificationSubscription.js'
import { currentEndpoint, fetchDevices, forgetDevice, renameDevice, sendTestNotification } from './push.js'
import { type TextField } from '../../../design/TextField.js'

/** Registered notification devices panel with renaming, test notifications and revocation. */
@component('mitra-notification-devices')
export class NotificationDevices extends Component {
	private static readonly shortBrands = new Map([['Google Chrome', 'Chrome'], ['Microsoft Edge', 'Edge'], ['Mozilla Firefox', 'Firefox']])

	@state() private tested?: 'event' | 'task'
	@state() private renamingId?: string

	private readonly devices = new Task(this, {
		args: () => [] as const,
		task: async () => ({
			endpoint: await currentEndpoint(),
			devices: await fetchDevices(),
		}),
	})

	protected override createRenderRoot() { return this }

	private readonly test = async (kind: 'event' | 'task') => {
		await sendTestNotification(kind)
		this.tested = kind
	}

	private readonly forget = async (device: NotificationSubscription) => {
		await forgetDevice(device)
		this.tested = undefined
		await this.devices.run()
	}

	/** Format relative time since device last seen. */
	private lastSeenLabel(value?: Date | string | null) {
		if (!value) {
			return t('never')
		}
		const hours = (Date.now() - new Date(value).getTime()) / 3_600_000
		const format = new Intl.RelativeTimeFormat(Localizer.locales.current, { numeric: 'auto' })
		return hours < 24 ? format.format(-Math.round(hours), 'hour') : format.format(-Math.round(hours / 24), 'day')
	}

	/** What the browser reports about itself, e.g. "Chrome on Android". */
	private reportedName(device: NotificationSubscription) {
		const browser = !device.browser ? undefined : NotificationDevices.shortBrands.get(device.browser) ?? device.browser
		const platform = device.platform || undefined
		if (browser && platform) {
			return t('${browser} on ${platform}', { browser, platform })
		}
		return browser ?? platform ?? t('Unknown device')
	}

	private name(device: NotificationSubscription) {
		return device.name || this.reportedName(device)
	}

	// A text field replaces the label: making a lit-rendered label contenteditable breaks lit's next update.
	private async startRename(device: NotificationSubscription) {
		this.renamingId = device.id
		await this.updateComplete
		const field = this.querySelector<TextField>(`mitra-text-field[data-rename-id="${device.id}"]`)
		field?.focus()
		field?.input?.select()
	}

	// Stopped, not just prevented: the dialog closes on any Escape that reaches the window.
	private handleRenameKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault()
			e.stopPropagation();
			(e.currentTarget as HTMLElement).blur()
		} else if (e.key === 'Escape') {
			e.preventDefault()
			e.stopPropagation()
			this.renamingId = undefined
		}
	}

	/** Typing the reported label back clears the custom name. */
	private async commitRename(device: NotificationSubscription, field: TextField) {
		if (this.renamingId !== device.id) {
			return
		}
		this.renamingId = undefined
		const typed = field.value.trim()
		const name = typed === this.reportedName(device) ? '' : typed
		if (name === (device.name ?? '')) {
			return
		}
		await renameDevice(device.id, name)
		await this.devices.run()
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
					flex-wrap: wrap;
					gap: 0.5rem 0.75rem;

					> h4 {
						margin: 0;
						margin-inline-end: auto;
						font-size: 0.75rem;
						font-weight: 600;
						color: var(--color-text-muted);
					}

					> .sent {
						flex-basis: 100%;
						font-size: 0.75rem;
						color: var(--color-text-muted);
					}
				}

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
						/* Echoes the settings row: glyph gutter, text, trailing controls. */
						display: grid;
						grid-template-columns: 1.375rem minmax(0, 1fr) auto;
						align-items: center;
						gap: 0.75rem;
						padding-block: 0.5rem;
						border-block-start: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent);

						&:first-child {
							border-block-start: none;
						}

						> mitra-icon {
							font-size: 1rem;
							color: var(--color-text-muted);
						}

						> .text {
							display: flex;
							flex-direction: column;
							gap: 0.125rem;
							min-inline-size: 0;

							> .title {
								display: flex;
								align-items: center;
								gap: 0.375rem;
								font-weight: 500;
								min-inline-size: 0;

								> .name {
									overflow: hidden;
									white-space: nowrap;
									text-overflow: ellipsis;
								}

								/* Exactly the label's line, so opening the rename moves nothing. */
								> mitra-text-field {
									flex: 1;
									min-inline-size: 0;
									--control-height: 1lh;
									--mitra-field-padding: 0;
									margin-inline-start: -1px;
								}

								> .here {
									flex-shrink: 0;
									font-size: 0.6875rem;
									font-weight: 400;
									padding: 0.0625rem 0.375rem;
									border-radius: var(--border-radius);
									color: var(--color-text-muted);
									background: color-mix(in srgb, var(--color-text) 8%, transparent);
								}
							}

							> .where {
								font-size: 0.75rem;
								color: var(--color-text-muted);
								overflow: hidden;
								white-space: nowrap;
								text-overflow: ellipsis;
							}
						}

						> .actions {
							display: flex;
							align-items: center;
							gap: 0.125rem;

							> mitra-icon-button {
								color: var(--color-text-muted);
								margin-block: -0.25rem;
								opacity: 0;
								transition: opacity 0.15s ease;
							}
						}

						&:hover > .actions > mitra-icon-button,
						> .actions > mitra-icon-button:focus-within {
							opacity: 1;
						}

						/* Nothing hovers on a touchscreen. */
						@media (pointer: coarse) {
							> .actions > mitra-icon-button {
								opacity: 1;
							}
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
				<mitra-button @click=${() => this.test('event')}>${t('Test event')}</mitra-button>
				<mitra-button @click=${() => this.test('task')}>${t('Test task')}</mitra-button>
				${!this.tested ? html.nothing : html`
					<span class="sent">${this.tested === 'task' ? t('Sent a test task reminder to your devices.') : t('Sent a test event reminder to your devices.')}</span>
				`}
			</header>
			${this.devices.render({
				pending: () => html.nothing,
				error: () => html`<p class="note">${t('Could not load your devices.')}</p>`,
				complete: ({ devices, endpoint }) => !devices.length
					? html`<p class="note">${t('No device is registered for reminders yet.')}</p>`
					: html`<ul>${devices.map(device => this.getDeviceTemplate(device, endpoint))}</ul>`,
			})}
		`
	}

	private getDeviceTemplate(device: NotificationSubscription, endpoint?: string) {
		const renaming = this.renamingId === device.id
		return html`
			<li>
				<mitra-icon icon=${device.mobile ? 'smartphone' : 'monitor'}></mitra-icon>
				<span class="text">
					<span class="title">
						${!renaming ? html`<span class="name">${this.name(device)}</span>` : html`
							<mitra-text-field plain data-rename-id=${device.id} maxlength="60"
								.value=${this.name(device)} aria-label=${t('Rename this device')}
								@keydown=${(e: KeyboardEvent) => this.handleRenameKeydown(e)}
								@focusout=${(e: Event) => this.commitRename(device, e.currentTarget as TextField)}
							></mitra-text-field>
						`}
						${renaming || device.endpoint !== endpoint ? html.nothing : html`<span class="here">${t('this device')}</span>`}
					</span>
					<span class="where">
						${[device.name ? this.reportedName(device) : undefined, device.timeZone || undefined, t('last seen ${when}', { when: this.lastSeenLabel(device.lastSeenAt) })].filter(Boolean).join(' · ')}
					</span>
				</span>
				<span class="actions">
					<mitra-icon-button size="small" icon="pencil" label=${t('Rename this device')} @click=${() => this.startRename(device)}></mitra-icon-button>
					<mitra-icon-button size="small" icon="x" label=${t('Stop notifying this device')} @click=${() => this.forget(device)}></mitra-icon-button>
				</span>
			</li>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-notification-devices': NotificationDevices
	}
}
