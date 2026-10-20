import { registerEngine } from '#integrations'
import { CalDAVSyncEngine } from '#integrations/caldav/server/CalDAVSyncEngine.js'
import { IcsSyncEngine } from '#integrations/ics/server/IcsSyncEngine.js'
import { TempoSyncEngine } from '#integrations/tempo/server/TempoSyncEngine.js'

const caldav = new CalDAVSyncEngine()
registerEngine('caldav', caldav)
registerEngine('apple', caldav)
registerEngine('google', caldav)
registerEngine('ics', new IcsSyncEngine())
registerEngine('tempo', new TempoSyncEngine())
