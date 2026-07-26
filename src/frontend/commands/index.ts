// The registry is populated by @command decorators running as a module-evaluation side effect, so
// THIS import order is the palette's display order (grouped by domain: entries, views, navigation,
// then app-level). Mirrors shared/index.ts's rule: don't convert these to type-only imports.
import './entries.js'
import './views.js'
import './navigation.js'
import './app.js'
export * from './Command.js'
