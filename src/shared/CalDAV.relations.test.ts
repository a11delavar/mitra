import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import ICAL from 'ical.js'
import { CalDAV } from './CalDAV.js'
import { Relation, RelationType } from './Relation.js'

// The losslessness contract behind the DIFF-based write (see CalDAV.writeRelations): a line the
// user didn't touch must survive VERBATIM — foreign directions, X- extensions, the RFC 9253 GAP
// parameter, and even parameters the model doesn't carry — or an unrelated mitra edit could
// silently destroy another client's relationship data.
describe('CalDAV relations round-trip', () => {
	const raw = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//test//EN',
		'BEGIN:VTODO',
		'UID:todo-1',
		'SUMMARY:Test',
		'RELATED-TO;RELTYPE=CHILD:child-uid',
		'RELATED-TO:bare-parent-uid',
		'RELATED-TO;RELTYPE=FINISHTOSTART;GAP=PT1D:predecessor-uid',
		'RELATED-TO;RELTYPE=X-DUPLICATE-OF:duplicate-uid',
		'END:VTODO',
		'END:VCALENDAR',
	].join('\r\n')

	const component = () => new ICAL.Component(ICAL.parse(raw)).getFirstSubcomponent('vtodo')!

	it('parses every RELTYPE opaquely, defaulting a bare RELATED-TO to PARENT (RFC 5545 §3.2.15)', () => {
		const relations = CalDAV.relationsFrom(component())
		assert.deepEqual(relations?.map(relation => [relation.type, relation.targetUid, relation.gap]), [
			[RelationType.Child, 'child-uid', null],
			[RelationType.FinishToStart, 'predecessor-uid', 'PT1D'],
			[RelationType.Parent, 'bare-parent-uid', null],
			['X-DUPLICATE-OF', 'duplicate-uid', null],
		])
	})

	it('write-then-parse is identity — an unchanged list leaves every line VERBATIM (diff, not rewrite)', () => {
		const subject = component()
		const parsed = CalDAV.relationsFrom(subject)

		;(new CalDAV() as any).writeRelations(subject, parsed)
		const reparsed = CalDAV.relationsFrom(subject)
		assert.equal(Relation.listEquals(parsed, reparsed), true)
		const serialized = subject.toString()
		assert.match(serialized, /RELATED-TO;RELTYPE=CHILD:child-uid/)
		assert.match(serialized, /RELATED-TO;RELTYPE=FINISHTOSTART;GAP=PT1D:predecessor-uid|RELATED-TO;GAP=PT1D;RELTYPE=FINISHTOSTART:predecessor-uid/)
		assert.match(serialized, /RELATED-TO;RELTYPE=X-DUPLICATE-OF:duplicate-uid/)
		// The bare line stays BARE — untouched lines are not re-authored into another form.
		assert.match(serialized, /RELATED-TO:bare-parent-uid/)
	})

	it('an edit that only ADDS a relation keeps foreign parameters the model does not carry', () => {
		const withForeignParams = new ICAL.Component(ICAL.parse([
			'BEGIN:VCALENDAR',
			'VERSION:2.0',
			'BEGIN:VEVENT',
			'UID:event-3',
			'SUMMARY:Foreign params',
			'RELATED-TO;RELTYPE=FINISHTOSTART;X-CLIENT-DATA=abc:kept-uid',
			'END:VEVENT',
			'END:VCALENDAR',
		].join('\r\n'))).getFirstSubcomponent('vevent')!
		const parsed = CalDAV.relationsFrom(withForeignParams)!
		const edited = Relation.normalize([...parsed, new Relation({ type: RelationType.Parent, targetUid: 'new-parent' })])

		;(new CalDAV() as any).writeRelations(withForeignParams, edited)
		const serialized = withForeignParams.toString()
		// The untouched foreign line survives byte-for-byte, X- parameter included …
		assert.match(serialized, /RELATED-TO;RELTYPE=FINISHTOSTART;X-CLIENT-DATA=abc:kept-uid/)
		// … and the added line appears alongside it.
		assert.match(serialized, /RELATED-TO;RELTYPE=PARENT:new-parent/)
	})

	it('two lines differing only in GAP are distinct relationships and both survive', () => {
		const gapped = new ICAL.Component(ICAL.parse([
			'BEGIN:VCALENDAR',
			'VERSION:2.0',
			'BEGIN:VEVENT',
			'UID:event-4',
			'SUMMARY:Gapped',
			'RELATED-TO;RELTYPE=FINISHTOSTART;GAP=PT1D:x',
			'RELATED-TO;RELTYPE=FINISHTOSTART;GAP=PT2D:x',
			'END:VEVENT',
			'END:VCALENDAR',
		].join('\r\n'))).getFirstSubcomponent('vevent')!
		const parsed = CalDAV.relationsFrom(gapped)
		assert.equal(parsed?.length, 2)

		;(new CalDAV() as any).writeRelations(gapped, parsed)
		assert.equal(CalDAV.relationsFrom(gapped)?.length, 2)
	})

	it('writing null clears every RELATED-TO line', () => {
		const subject = component()

		;(new CalDAV() as any).writeRelations(subject, null)
		assert.equal(CalDAV.relationsFrom(subject), null)
		assert.doesNotMatch(subject.toString(), /RELATED-TO/)
	})

	it('parses no RELATED-TO as the canonical null, and dedupes repeated lines', () => {
		const bare = new ICAL.Component(ICAL.parse([
			'BEGIN:VCALENDAR',
			'VERSION:2.0',
			'BEGIN:VEVENT',
			'UID:event-1',
			'SUMMARY:No relations',
			'END:VEVENT',
			'END:VCALENDAR',
		].join('\r\n'))).getFirstSubcomponent('vevent')!
		assert.equal(CalDAV.relationsFrom(bare), null)

		const doubled = new ICAL.Component(ICAL.parse([
			'BEGIN:VCALENDAR',
			'VERSION:2.0',
			'BEGIN:VEVENT',
			'UID:event-2',
			'SUMMARY:Doubled',
			'RELATED-TO;RELTYPE=PARENT:p',
			'RELATED-TO:p',
			'END:VEVENT',
			'END:VCALENDAR',
		].join('\r\n'))).getFirstSubcomponent('vevent')!
		assert.equal(CalDAV.relationsFrom(doubled)?.length, 1)
	})
})
