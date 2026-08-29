// The registry is populated by @command decorators running as a module-evaluation side effect, so
// THIS import order is the palette's display order (grouped by domain: entries, views, navigation,
// then app-level). Mirrors integrations/registerIntegrations.ts's rule: don't convert these to
// type-only imports.
import '../features/entries/client/commands.js'
import '../features/calendar/client/viewsCommands.js'
import '../features/calendar/client/navigationCommands.js'
import '../features/commands/client/appCommands.js'
import '../features/settings/client/commands.js'
export * from '../features/commands/Command.js'
// Not part of the registry — one verb per calendar, built from the store per render (see sources.ts).
export * from '../features/sources/client/commands.js'
// Nor these — one verb per setting VALUE, so they change as the values do (see settings/client/commands.ts).
export { settingCommands } from '../features/settings/client/commands.js'
