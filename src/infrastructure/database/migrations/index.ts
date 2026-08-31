import { type Migration } from '@mikro-orm/migrations'
import { type Constructor } from '@mikro-orm/core'

import { Migration20260802210039_Initial } from './Migration20260802210039_Initial.js'
import { Migration20260802230147_MergeSourceTypes } from './Migration20260802230147_MergeSourceTypes.js'
import { Migration20260817182359_SoloSourceVisibility } from './Migration20260817182359_SoloSourceVisibility.js'
import { Migration20260820213906_EntryTransparencyAndVisibility } from './Migration20260820213906_EntryTransparencyAndVisibility.js'
import { Migration20260821120000_EntryRelations } from './Migration20260821120000_EntryRelations.js'
import { Migration20260822140000_EntryPercentComplete } from './Migration20260822140000_EntryPercentComplete.js'
import { Migration20260826182337_AddSourceReadOnly } from './Migration20260826182337_AddSourceReadOnly.js'
import { Migration20260828152137_UserSettings } from './Migration20260828152137_UserSettings.js'
import { Migration20260829101122_AddNotificationSubscriptionDevice } from './Migration20260829101122_AddNotificationSubscriptionDevice.js'
import { Migration20260831093000_SourceImportedAt } from './Migration20260831093000_SourceImportedAt.js'
/**
 * Every migration the app ships, oldest first. The backend bundles into a single file, so migrations
 * are imported explicitly rather than discovered on disk — `npm run db:migration:create` generates a
 * new migration and appends it here.
 */
export const migrations: Array<Constructor<Migration>> = [
	Migration20260802210039_Initial,
	Migration20260802230147_MergeSourceTypes,
	Migration20260817182359_SoloSourceVisibility,
	Migration20260820213906_EntryTransparencyAndVisibility,
	Migration20260821120000_EntryRelations,
	Migration20260822140000_EntryPercentComplete,
	Migration20260826182337_AddSourceReadOnly,
	Migration20260828152137_UserSettings,
	Migration20260829101122_AddNotificationSubscriptionDevice,
	Migration20260831093000_SourceImportedAt,
]
