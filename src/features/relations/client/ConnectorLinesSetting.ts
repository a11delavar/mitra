import { setting, ToggleSetting, type SettingStorage } from '../../settings/client/Setting.js'
import { EntryConnections } from './EntryConnections.js'

type ConnectionView = 'week' | 'month' | 'timeline'

/**
 * Relationship connector line overlay visibility toggle per calendar view.
 */
abstract class ConnectorLinesSetting extends ToggleSetting {
	constructor(private readonly view: ConnectionView) {
		super()
	}

	readonly icon = 'git-branch'
	readonly keywords = t('ConnectorLines.Keywords')
	readonly page = 'calendar'
	readonly fallback = true

	protected readonly storage: SettingStorage<boolean> = {
		read: () => EntryConnections.isEnabledFor(this.view),
		write: value => EntryConnections.setEnabledFor(this.view, value),
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
