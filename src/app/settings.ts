// Side-effect imports registering settings in row display order.
// ThemeSetting executes at module evaluation to apply data-theme before first paint.
import '../design/ThemeSetting.js'
import '../infrastructure/i18n/LanguageSetting.js'
import '../features/calendar/client/DefaultViewSetting.js'
import '../features/entries/client/HideDoneTasksSetting.js'
import '../features/relations/client/ConnectorLinesSetting.js'
import '../features/sources/client/DefaultSourceSetting.js'
import '../features/entries/client/DefaultDurationSetting.js'
import '../features/entries/client/SnapSetting.js'
import '../features/reminders/client/NotificationsSetting.js'
import '../features/reminders/client/DefaultReminderSetting.js'
export * from '../features/settings/client/Setting.js'
