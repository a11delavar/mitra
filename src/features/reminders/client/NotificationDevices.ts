import { Component, component, html, css, state } from '@a11d/lit'
import { Task } from '@lit/task'
import { type NotificationSubscription } from '../NotificationSubscription.js'
import { currentEndpoint, fetchDevices, forgetDevice, renameDevice } from './push.js'
import { type TextField } from '../../../design/TextField.js'
import { ClockController } from '../../time/client/ClockController.js'

/** The devices that receive the user's reminders, each renamed or removed from its menu; laid out as its setting's list. */
@component('mitra-notification-devices')
export class NotificationDevices extends Component {
	private static readonly shortBrands = new Map([['Google Chrome', 'Chrome'], ['Microsoft Edge', 'Edge'], ['Mozilla Firefox', 'Firefox']])

	@state() private renamingId?: string

	protected readonly clock = new ClockController(this)

	private readonly devices = new Task(this, {
		args: () => [] as const,
		task: async () => ({
			endpoint: await currentEndpoint(),
			devices: await fetchDevices(),
		}),
	})

	protected override createRenderRoot() { return this }

	private readonly forget = async (device: NotificationSubscription) => {
		await forgetDevice(device)
		await this.devices.run()
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
			/* Exactly the label's line, so opening the rename moves nothing. */
			mitra-notification-devices mitra-text-field {
				--control-height: 1lh;
				--mitra-field-padding: 0;
				margin-inline-start: -1px;
			}
		`
	}

	protected override get template() {
		return html`${this.devices.render({
			pending: () => html.nothing,
			error: () => html`<p class="note">${t('Could not load your devices.')}</p>`,
			complete: ({ devices, endpoint }) => !devices.length
				? html`<p class="note">${t('No device is registered for reminders yet.')}</p>`
				: html`<ul>${devices.map(device => this.getDeviceTemplate(device, endpoint))}</ul>`,
		})}`
	}

	private getDeviceTemplate(device: NotificationSubscription, endpoint?: string) {
		const seen = !device.lastSeenAt ? t('never') : new DateTime(device.lastSeenAt).since().format()
		return html`
			<li>
				<mitra-icon icon=${device.mobile ? 'smartphone' : 'monitor'}></mitra-icon>
				<span class="text">
					${this.renamingId !== device.id ? html`<span class="label">${this.name(device)}</span>` : html`
						<mitra-text-field plain data-rename-id=${device.id} maxlength="60"
							.value=${this.name(device)} aria-label=${t('Rename this device')}
							@keydown=${(e: KeyboardEvent) => this.handleRenameKeydown(e)}
							@focusout=${(e: Event) => this.commitRename(device, e.currentTarget as TextField)}
						></mitra-text-field>
					`}
					<span class="hint">
						${[device.name ? this.reportedName(device) : undefined, device.timeZone || undefined, t('last seen ${when}', { when: seen })].filter(Boolean).join(' · ')}
					</span>
				</span>
				<span class="end">
					${device.endpoint !== endpoint ? html.nothing : html`<span class="chip">${t('this device')}</span>`}
					<mitra-popover-container>
						<mitra-icon-button size="small" icon="more-horizontal" label=${t('Options')}></mitra-icon-button>
						<mitra-menu slot="popover">
							<mitra-menu-item icon="pencil" @click=${() => this.startRename(device)}>${t('Rename this device')}</mitra-menu-item>
							<mitra-menu-item icon="x" variant="danger" @click=${() => this.forget(device)}>${t('Stop notifying this device')}</mitra-menu-item>
						</mitra-menu>
					</mitra-popover-container>
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
