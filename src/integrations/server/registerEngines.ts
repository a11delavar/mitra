/**
 * Registers every {@link SyncEngine}, server-side only — the reason {@link Integration}'s CRUD/sync
 * methods can stay concrete (delegating through the registry) without the class itself pulling a
 * protocol library into the browser bundle. Import this once, early in the backend's own boot (see
 * app/server.ts) — before that, any of those methods throws for a type no engine covers.
 *
 * One CalDAVSyncEngine instance serves all three CalDAV-protocol discriminators: Apple and Google are
 * manifest-only subclasses of CalDAV (a fixed server URL, an OAuth credential shape, a couple of
 * capability/config overrides) — neither implements a byte of sync/CRUD logic of its own. Notion's
 * (Notion.ts) hasn't made this split yet — it still implements its own engine methods directly, so
 * nothing is registered for it here.
 */
import { registerEngine } from '../Integration.js'
import { CalDAVSyncEngine } from '../caldav/server/CalDAVSyncEngine.js'
import { TempoSyncEngine } from '../tempo/server/TempoSyncEngine.js'

const caldav = new CalDAVSyncEngine()
registerEngine('caldav', caldav)
registerEngine('apple', caldav)
registerEngine('google', caldav)

registerEngine('tempo', new TempoSyncEngine())
