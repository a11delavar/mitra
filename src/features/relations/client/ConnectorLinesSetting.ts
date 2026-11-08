import { setting, ToggleSetting, deviceStorage, type SettingStorage } from '#features/settings/client/Setting.js'
import { EntryStore } from '#features/entries/client/EntryStore.js'

type ConnectionView = 'week' | 'month' | 'timeline'

/**
 * Relationship connector line overlay visibility toggle per calendar view.
 */
export abstract class ConnectorLinesSetting extends ToggleSetting {
	/** Whether `view` draws its connector lines. */
	static showsIn(view: ConnectionView) {
		switch (view) {
			case 'week': return new WeekConnectorLinesSetting().value
			case 'month': return new MonthConnectorLinesSetting().value
			case 'timeline': return new TimelineConnectorLinesSetting().value
		}
	}

	constructor(private readonly view: ConnectionView) {
		super()
	}

	readonly icon = 'git-branch'
	readonly keywords = t('ConnectorLines.Keywords')
	readonly page = 'calendar'
	readonly fallback = true

	/** The views read it as they draw, so a change redraws them. */
	protected get storage(): SettingStorage<boolean> {
		const kept = deviceStorage<boolean>(`Mitra.Connections.${this.view}`)
		return {
			read: () => kept.read(),
			write: value => {
				kept.write(value)
				EntryStore.notify()
			},
		}
	}
}

@setting()
export class WeekConnectorLinesSetting extends ConnectorLinesSetting {
	constructor() { super('week') }
	readonly heading = t('Connector lines in the week view')
}

@setting()
export class MonthConnectorLinesSetting extends ConnectorLinesSetting {
	constructor() { super('month') }
	readonly heading = t('Connector lines in the month view')
}

@setting()
export class TimelineConnectorLinesSetting extends ConnectorLinesSetting {
	constructor() { super('timeline') }
	readonly heading = t('Connector lines in the timeline')
}
