import { registerEngine } from '#integrations'
import { CalDAVSyncEngine } from '#integrations/caldav/server/CalDAVSyncEngine.js'
import { IcsSyncEngine } from '#integrations/ics/server/IcsSyncEngine.js'
import { TempoSyncEngine } from '#integrations/tempo/server/TempoSyncEngine.js'
import { TodoistSyncEngine } from '#integrations/todoist/server/TodoistSyncEngine.js'
import { TickTickSyncEngine } from '#integrations/ticktick/server/TickTickSyncEngine.js'

const caldav = new CalDAVSyncEngine()
registerEngine('caldav', caldav)
registerEngine('apple', caldav)
registerEngine('google', caldav)
registerEngine('ics', new IcsSyncEngine())
registerEngine('tempo', new TempoSyncEngine())
registerEngine('todoist', new TodoistSyncEngine())
registerEngine('ticktick', new TickTickSyncEngine())
