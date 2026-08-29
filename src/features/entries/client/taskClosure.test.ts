import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Entry, TaskStatus } from '../Entry.js'
import { EntryType } from '../EntryType.js'
import { Integration } from '../../../integrations/Integration.js'
import { Notion } from '../../../integrations/notion/Notion.js'
import { closeTask } from './taskClosure.js'

describe('closeTask', () => {
	const task = (init?: Partial<Entry>) => new Entry({ id: 'a', sourceId: 's', type: EntryType.Task, heading: 'Ship it', status: TaskStatus.ToDo, ...init })

	it('records full progress where the provider can hold it', () => {
		const entry = task()
		closeTask(entry, TaskStatus.Done, Integration.fullCapabilities)
		assert.equal(entry.status, TaskStatus.Done)
		assert.equal(entry.percentComplete, 100)
	})

	it('leaves progress unstated where it cannot — the status alone carries done', () => {
		const entry = task()
		closeTask(entry, TaskStatus.Done, new Notion().capabilities)
		assert.equal(entry.status, TaskStatus.Done)
		assert.equal(entry.percentComplete, null)
	})

	it('keeps the progress a cancelled task already had', () => {
		const entry = task({ status: TaskStatus.Doing, percentComplete: 40 })
		closeTask(entry, TaskStatus.Cancelled, Integration.fullCapabilities)
		assert.equal(entry.status, TaskStatus.Cancelled)
		assert.equal(entry.percentComplete, 40)
	})
})
