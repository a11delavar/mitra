import { getCapabilities } from '../../../infrastructure/http/Api.js'
import { type Entry, TaskStatus } from '../Entry.js'
import { type Integration } from '../../../integrations/Integration.js'

/**
 * Sets task status and writes 100% progress on Done if the provider supports `percentComplete` (RFC 5545 §3.8.1.8).
 */
export function closeTask(entry: Entry, status: TaskStatus, capabilities: Integration['capabilities'] = getCapabilities(entry.sourceId)) {
	entry.status = status
	if (status === TaskStatus.Done && capabilities.percentComplete) {
		entry.percentComplete = 100
	}
}
