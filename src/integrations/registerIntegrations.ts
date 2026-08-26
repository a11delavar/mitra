/**
 * Every connectable {@link Integration} subclass, gathered in one place so their registration order is
 * an explicit, commented list rather than an accident of which file happens to import which class by
 * name. Each `@integration` decorator registers as an IMPORT SIDE EFFECT (see Integration.ts), so this
 * file's own import order below IS the add-integration dialog's tile order — reorder the lines to
 * reorder the tiles. Whoever needs a provider class re-exports it from here rather than importing the
 * class file directly, so evaluating that import always pulls in the full, correctly ordered set (a
 * frontend file that only ever names `CalDAV` and `Notion` would otherwise never load — and so never
 * register — `GoogleCalendar` or `AppleCalendar` at all).
 */
export { CalDAV } from './caldav/CalDAV.js'
export { GoogleCalendar } from './google/GoogleCalendar.js'
export { AppleCalendar } from './apple/AppleCalendar.js'
export { IcsSubscription } from './ics/IcsSubscription.js'
export { Notion } from './notion/Notion.js'
export { Tempo } from './tempo/Tempo.js'
