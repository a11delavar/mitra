import { Controller } from '@a11d/lit'
import { type ReactiveControllerHost } from 'lit'

/** Reactive controller triggering updates across components that display settings. */
export class SettingsStore extends Controller {
	private static readonly hosts = new Set<ReactiveControllerHost>()

	static notify() {
		this.hosts.forEach(host => host.requestUpdate())
	}

	override hostConnected() {
		SettingsStore.hosts.add(this.host)
	}

	override hostDisconnected() {
		SettingsStore.hosts.delete(this.host)
	}
}
