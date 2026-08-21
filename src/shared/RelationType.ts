import { type Converter } from '@a11d/converter'
import { Type } from './orm.js'

/**
 * WHERE a relationship line groups in the editor: by EDGE semantics, not stored direction — a
 * foreign CHILD pointing here and an owned PARENT pointing away both read "Subtask of" — so mirror
 * pairs share a glyph (the kind) while the label carries the direction. Open like
 * {@link RelationType}: an uninterpreted type is its own section, labelled by its raw value.
 */
export class RelationSection {
	static readonly BlockedBy = new RelationSection('blocked-by', 'waypoints')
	static readonly Blocks = new RelationSection('blocks', 'waypoints')
	static readonly SubtaskOf = new RelationSection('subtask-of', 'list-tree')
	static readonly Subtasks = new RelationSection('subtasks', 'list-tree')
	static readonly Related = new RelationSection('related', 'link')

	/** Display order: authorable families lead, mirror pairs stay adjacent; opaque sections trail. */
	static readonly all: ReadonlyArray<RelationSection> = [RelationSection.BlockedBy, RelationSection.Blocks, RelationSection.SubtaskOf, RelationSection.Subtasks, RelationSection.Related]

	private static readonly opaque = new Map<string, RelationSection>()

	/** One cached instance per value, known or not — {@link RelationType.of}'s contract. */
	static of(value: RelationSection | string): RelationSection {
		if (value instanceof RelationSection) {
			return value
		}
		let instance = RelationSection.all.find(section => section.value === value) ?? RelationSection.opaque.get(value)
		if (!instance) {
			instance = new RelationSection(value, 'link')
			RelationSection.opaque.set(value, instance)
		}
		return instance
	}

	private constructor(readonly value: string, readonly icon: string) { }

	get rank() {
		const index = RelationSection.all.indexOf(this)
		return index < 0 ? RelationSection.all.length : index
	}

	/** The section's heading. FRONTEND-ONLY, like {@link EntryType.format} — `t()` is a frontend
	 * global; the i18n scanner tracks these shared keys. An opaque section reads as its raw value. */
	format(): string {
		switch (this) {
			case RelationSection.BlockedBy:
				return t('Blocked by')
			case RelationSection.Blocks:
				return t('Blocks')
			case RelationSection.SubtaskOf:
				return t('Subtask of')
			case RelationSection.Subtasks:
				return t('Subtasks')
			case RelationSection.Related:
				return t('Related to')
			default:
				return this.value
		}
	}

	toString() {
		return this.value
	}
}

/**
 * HOW one entry relates to another: the iCalendar RELTYPE vocabulary (RFC 5545 §3.2.15 hierarchy,
 * RFC 9253 §5 temporal dependencies) as a value object, following {@link EntryType}'s pattern — the
 * type answers its own questions (family, sections, authorability, edge readings), and there is one
 * instance per value, so `===` is the whole comparison story.
 *
 * Unlike EntryType the vocabulary is OPEN: an unknown value (`X-…`) is data that must round-trip,
 * never an error — so {@link of} answers a cached opaque instance instead of throwing, and
 * {@link Relation.type} stays a raw string (relations tolerate plain wire DTOs), reaching this
 * behaviour via `of()`.
 */
export class RelationType {
	/** This entry is a child of the target — Mitra's canonical hierarchy direction. */
	static readonly Parent = new RelationType('PARENT')
	/** The target is a child of this entry. Foreign clients author this; Mitra never does. */
	static readonly Child = new RelationType('CHILD')
	/** This entry and the target share a parent. Derivable, so Mitra never authors it. */
	static readonly Sibling = new RelationType('SIBLING')
	/** This entry cannot start until the target finishes — Mitra's canonical dependency direction. */
	static readonly FinishToStart = new RelationType('FINISHTOSTART')
	/** This entry cannot finish until the target finishes. */
	static readonly FinishToFinish = new RelationType('FINISHTOFINISH')
	/** This entry cannot start until the target starts. */
	static readonly StartToStart = new RelationType('STARTTOSTART')
	/** This entry cannot finish until the target starts. */
	static readonly StartToFinish = new RelationType('STARTTOFINISH')

	/** The types the editor OFFERS, in UI order — everything else round-trips and renders read-only. */
	static readonly authorable: ReadonlyArray<RelationType> = [RelationType.FinishToStart, RelationType.Parent]

	private static readonly known = new Map<string, RelationType>(
		[RelationType.Parent, RelationType.Child, RelationType.Sibling, RelationType.FinishToStart, RelationType.FinishToFinish, RelationType.StartToStart, RelationType.StartToFinish]
			.map(type => [type.value, type]))

	/** One cached instance per UNKNOWN value too, so `===` works for `X-` types like any other. */
	private static readonly opaque = new Map<string, RelationType>()

	/** The one instance for a value, however spelled — normalized like {@link Relation.normalize}
	 * (trimmed, UPPERCASE), so a parsed line and a constructed instance meet on the same identity. */
	static of(value: RelationType | string): RelationType {
		if (value instanceof RelationType) {
			return value
		}
		const normalized = value.trim().toUpperCase()
		let instance = RelationType.known.get(normalized) ?? RelationType.opaque.get(normalized)
		if (!instance) {
			instance = new RelationType(normalized)
			RelationType.opaque.set(normalized, instance)
		}
		return instance
	}

	private constructor(readonly value: string) { }

	/** Hierarchy and dependency form SEPARATE constraint graphs (a task may be both a subtask of A
	 * and depend on A); uninterpreted types join neither and constrain nothing. */
	get family(): 'hierarchy' | 'dependency' | undefined {
		switch (this) {
			case RelationType.Parent:
			case RelationType.Child:
				return 'hierarchy'
			case RelationType.FinishToStart:
			case RelationType.FinishToFinish:
			case RelationType.StartToStart:
			case RelationType.StartToFinish:
				return 'dependency'
			default:
				return undefined
		}
	}

	/** The {@link RelationSection} a stored line of this type groups into — the hierarchy pair flips
	 * within one family, so this is the instance's knowledge, not the family's. */
	get section(): RelationSection {
		switch (this) {
			case RelationType.Parent:
				return RelationSection.SubtaskOf
			case RelationType.Child:
				return RelationSection.Subtasks
			case RelationType.Sibling:
				return RelationSection.Related
			default:
				return this.family === 'dependency' ? RelationSection.BlockedBy : RelationSection.of(this.value)
		}
	}

	/** The same edge read from the target's side — a DERIVED line, so every reading flips. */
	get inverseSection(): RelationSection {
		switch (this) {
			case RelationType.Parent:
				return RelationSection.Subtasks
			case RelationType.Child:
				return RelationSection.SubtaskOf
			case RelationType.Sibling:
				return RelationSection.Related
			default:
				return this.family === 'dependency' ? RelationSection.Blocks : RelationSection.of(this.value)
		}
	}

	get isAuthorable() {
		return RelationType.authorable.includes(this)
	}

	/** The hierarchy edge a stored pointer means, whichever direction it was authored in. */
	hierarchyEdge(ownerUid: string, targetUid: string): { parent: string, child: string } | undefined {
		switch (this) {
			case RelationType.Parent:
				return { parent: targetUid, child: ownerUid }
			case RelationType.Child:
				return { parent: ownerUid, child: targetUid }
			default:
				return undefined
		}
	}

	/** All four temporal types sit on the DEPENDENT and target what it waits for (RFC 9253's
	 * authoring direction), differing only in which boundaries they couple. */
	dependencyEdge(ownerUid: string, targetUid: string): { dependent: string, predecessor: string } | undefined {
		return this.family === 'dependency' ? { dependent: ownerUid, predecessor: targetUid } : undefined
	}

	/** Carries ONE type across the API as its value, coming back as the instance. */
	static readonly converter: Converter<string | undefined, RelationType | undefined> = {
		construct: value => value === undefined ? undefined : RelationType.of(value),
		deconstruct: value => value?.value,
	}

	/** Persists ONE type as its value in a text column, hydrating back as the instance. */
	static readonly Mapper = class extends Type<RelationType, string> {
		override convertToDatabaseValue(value: RelationType | string): string {
			return RelationType.of(value).value
		}

		override convertToJSValue(value: RelationType | string): RelationType {
			return RelationType.of(value)
		}

		override getColumnType(): string {
			return 'text'
		}
	}

	/** Interpolates and serializes as the wire value — the same word the .ics carries. */
	toString() {
		return this.value
	}

	toJSON() {
		return this.value
	}
}
