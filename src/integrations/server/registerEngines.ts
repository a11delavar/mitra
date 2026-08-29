import { registerEngine } from '../Integration.js'
import { CalDAVSyncEngine } from '../caldav/server/CalDAVSyncEngine.js'
import { IcsSyncEngine } from '../ics/server/IcsSyncEngine.js'
import { TempoSyncEngine } from '../tempo/server/TempoSyncEngine.js'

const caldav = new CalDAVSyncEngine()
registerEngine('caldav', caldav)
registerEngine('apple', caldav)
registerEngine('google', caldav)
registerEngine('ics', new IcsSyncEngine())
registerEngine('tempo', new TempoSyncEngine())
