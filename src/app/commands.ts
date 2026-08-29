// Side-effect imports populate command registry in display order.
import '../features/entries/client/commands.js'
import '../features/calendar/client/viewsCommands.js'
import '../features/calendar/client/navigationCommands.js'
import '../features/commands/client/appCommands.js'
import '../features/settings/client/commands.js'
export * from '../features/commands/Command.js'
export * from '../features/sources/client/commands.js'
export { settingCommands } from '../features/settings/client/commands.js'
