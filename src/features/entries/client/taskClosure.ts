import { getCapabilities } from '../../../infrastructure/http/Api.js'
import { type Entry, TaskStatus } from '../Entry.js'
import { type Integration } from '../../../integrations/Integration.js'

/**
 * Close a task — the one place a closure's progress side is decided. RFC 5545 §3.8.1.8 puts
 * PERCENT-COMPLETE at 100 on Done, but only where the provider can hold one: Notion carries "done" in
 * the status alone, and an unstorable progress value has the backend refuse the whole edit.
 */
export function closeTask(entry: Entry, status: TaskStatus, capabilities: Integration['capabilities'] = getCapabilities(entry.sourceId)) {
	entry.status = status
	if (status === TaskStatus.Done && capabilities.percentComplete) {
		entry.percentComplete = 100
	}
}
