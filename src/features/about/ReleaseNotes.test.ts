import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ReleaseCapture, ReleaseContributor, ReleaseDocs, ReleaseNotes } from './ReleaseNotes.js'

const notes = `---
title: Due dates, availability and calmer reminders
date: 2026-10-05
---
This release is about tasks with a deadline but no slot yet.

## Due dates and estimates
A task can carry a due date before it has a time. Unscheduled tasks line up in Planning.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="due-detail-dark.webp">
	<img src="due-detail-light.webp" alt="The editor with a due date">
</picture>

Docs: [Planning](../../docs/planning.md)

## Calendars kept in Mitra
No capture for this one.

## Planning by dragging
A task dragged into the week.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="plan-task-dark.webp">
	<img src="plan-task-light.webp" alt="A task dragged into the week">
</picture>

## Upgrading
Nothing to do.
`

describe('ReleaseNotes', () => {
	it('reads the frontmatter, the intro and one highlight per heading', () => {
		const parsed = ReleaseNotes.parse(notes)
		assert.equal(parsed.title, 'Due dates, availability and calmer reminders')
		assert.equal(parsed.date, '2026-10-05')
		assert.equal(parsed.intro, 'This release is about tasks with a deadline but no slot yet.')
		assert.deepEqual(parsed.highlights.map(highlight => highlight.heading), ['Due dates and estimates', 'Calendars kept in Mitra', 'Planning by dragging'])
	})

	it('lifts the capture\'s picture and the docs line out of a highlight', () => {
		const parsed = ReleaseNotes.parse(notes)
		const [first, second, third] = parsed.highlights
		assert.deepEqual(first!.capture, new ReleaseCapture('due-detail', 'The editor with a due date'))
		assert.deepEqual(first!.docs, new ReleaseDocs('Planning', '../../docs/planning.md'))
		assert.equal(first!.markdown, 'A task can carry a due date before it has a time. Unscheduled tasks line up in Planning.')
		assert.equal(first!.lead, 'A task can carry a due date before it has a time.')
		assert.equal(second!.capture, undefined)
		assert.equal(second!.docs, undefined)
		assert.deepEqual(third!.capture, new ReleaseCapture('plan-task', 'A task dragged into the week'))
		assert.equal(third!.markdown, 'A task dragged into the week.')
		assert.deepEqual(parsed.captures, ['due-detail', 'plan-task'])
		assert.equal(first!.capture!.file('dark', 'mp4'), 'due-detail-dark.mp4')
	})

	it('keeps Upgrading apart from the highlights', () => {
		const parsed = ReleaseNotes.parse(notes)
		assert.deepEqual(parsed.rest.map(section => [section.heading, section.markdown]), [['Upgrading', 'Nothing to do.']])
	})

	it('reads a foreword apart from the highlights and the rest', () => {
		const parsed = ReleaseNotes.parse('---\ntitle: First\n---\nThe first one.\n\n## Why Mitra\nWhy it exists.\n\n## Week view\nA grid.\n')
		assert.equal(parsed.foreword?.markdown, 'Why it exists.')
		assert.deepEqual(parsed.highlights.map(highlight => highlight.heading), ['Week view'])
		assert.deepEqual(parsed.rest, [])
	})

	it('reads a letter\'s closing profile link as its signature', () => {
		const parsed = ReleaseNotes.parse('---\ntitle: First\n---\nThe first one.\n\n## Why Mitra\nWhy it exists.\n\n[@someone](https://github.com/someone)\n')
		assert.equal(parsed.foreword?.markdown, 'Why it exists.')
		assert.equal(parsed.foreword?.signature?.name, '@someone')
		assert.equal(parsed.foreword?.signature?.avatar, 'https://github.com/someone.png?size=96')
	})

	it('is a draft without a date', () => {
		const parsed = ReleaseNotes.parse('---\ntitle: Next\n---\nSoon.\n')
		assert.equal(parsed.date, undefined)
		assert.equal(parsed.intro, 'Soon.')
		assert.deepEqual(parsed.highlights, [])
	})

	it('stamps the date into the frontmatter once', () => {
		const dated = ReleaseNotes.parse('---\ntitle: Next\n---\nSoon.\n').withDate('2026-11-01')
		assert.equal(dated.markdown, '---\ntitle: Next\ndate: 2026-11-01\n---\nSoon.\n')
		assert.equal(dated.date, '2026-11-01')
		assert.equal(dated.withDate('2026-11-02').markdown, '---\ntitle: Next\ndate: 2026-11-02\n---\nSoon.\n')
		assert.equal(ReleaseNotes.parse('Soon.\n').withDate('2026-11-01').markdown, '---\ndate: 2026-11-01\n---\nSoon.\n')
	})

	it('reads the contributors as people and adds the ones a cut finds in git', () => {
		const listed = ReleaseNotes.parse(`${notes}\n## Contributors\n- [@maintainer](https://github.com/maintainer)\n- A friend: the logo\n`)
		assert.deepEqual(listed.contributors.map(person => [person.name, person.login, person.role]), [['@maintainer', 'maintainer', undefined], ['A friend', undefined, 'the logo']])
		assert.equal(listed.contributors[0]!.avatar, 'https://github.com/maintainer.png?size=96')
		assert.deepEqual(listed.rest.map(section => section.heading), ['Upgrading'])

		const authors = [ReleaseContributor.ofCommit('maintainer', 'me@example.com'), ReleaseContributor.ofCommit('Some One', '123+someone@users.noreply.github.com'), ReleaseContributor.ofCommit('Jane Roe', 'jane@example.com')]
		assert.equal(authors[1]!.line, '- [@someone](https://github.com/someone)')
		assert.equal(authors[2]!.line, '- Jane Roe')
		const added = listed.withContributors(authors)
		assert.deepEqual(added.contributors.map(person => person.name), ['@maintainer', 'A friend', '@someone', 'Jane Roe'])
		assert.equal(added.withContributors(authors), added)
		assert.equal(ReleaseNotes.parse(notes).withContributors(authors.slice(1)).markdown, `${notes.trimEnd()}\n\n## Contributors\n- [@someone](https://github.com/someone)\n- Jane Roe\n`)
	})

	it('names the minor a version belongs to', () => {
		assert.equal(ReleaseNotes.minorOf('v0.6.2'), '0.6')
		assert.equal(ReleaseNotes.minorOf('0.6.0-rc.1'), '0.6')
		assert.equal(ReleaseNotes.minorOf('0.6'), '0.6')
		assert.equal(ReleaseNotes.isMinorRelease('v0.7.0'), true)
		assert.equal(ReleaseNotes.isMinorRelease('0.7.0-rc.1'), true)
		assert.equal(ReleaseNotes.isMinorRelease('0.7.1'), false)
	})
})
