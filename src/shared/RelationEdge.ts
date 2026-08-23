import type { DateTime } from '@3mo/date-time'
import type { Relation, RelationInit } from './Relation.js'
import { RelationType } from './RelationType.js'

/** Structural boundary interface required to evaluate temporal coupling. */
export interface RelationEndpoint {
	boundaryOf(which: 'start' | 'end'): DateTime | undefined
}

/**
 * Resolved directed edge normalized to canonical direction (parent → child, predecessor → dependent).
 * Acts as the domain layer between perspectival {@link Relation} pointers and {@link RelationGraph}.
 * Endpoints are UIDs and may dangle when targets are not loaded.
 */
export class RelationEdge {
	/** Resolves a stored relation pointer to a directed edge, or undefined for uninterpreted types. */
	static of(ownerUid: string, relation: Relation | RelationInit): RelationEdge | undefined {
		const type = RelationType.of(relation.type ?? '')
		const targetUid = relation.targetUid
		if (!targetUid) {
			return undefined
		}
		const gap = relation.gap ?? null
		const hierarchy = type.hierarchyEdge(ownerUid, targetUid)
		if (hierarchy) {
			return new RelationEdge('hierarchy', hierarchy.parent, hierarchy.child, type, gap)
		}
		const dependency = type.dependencyEdge(ownerUid, targetUid)
		return !dependency ? undefined : new RelationEdge('dependency', dependency.predecessor, dependency.dependent, type, gap)
	}

	private constructor(
		readonly family: 'hierarchy' | 'dependency',
		readonly from: string,
		readonly to: string,
		readonly type: RelationType,
		/** RFC 9253 lead/lag duration string. */
		readonly gap: string | null,
	) { }

	/** Direction-normalized pair identity, used to deduplicate edges gathered from both endpoints. */
	get key() {
		return `${this.family} ${this.from} ${this.to}`
	}

	/** Coupled boundaries for temporal dependencies; undefined for hierarchy edges. */
	get coupling() {
		const coupling = this.type.coupling
		return !coupling ? undefined : { from: coupling.predecessor, to: coupling.dependent }
	}

	/** Selects the occurrence pair connecting recurring series. Pairs satisfying the coupling are
	 * preferred over closer pairs that violate it. Nearness serves as tie-breaker. */
	bestPair<T extends RelationEndpoint & { start?: { valueOf(): number } }>(fromCandidates: ReadonlyArray<T>, toCandidates: ReadonlyArray<T>): { from: T, to: T } | undefined {
		let best: { from: T, to: T } | undefined
		let bestScore: readonly [number, number] = [Infinity, Infinity]
		for (const from of fromCandidates) {
			for (const to of toCandidates) {
				if (from === to) {
					continue
				}
				const score = [this.violatedBy(from, to) ? 1 : 0, Math.abs((from.start?.valueOf() ?? 0) - (to.start?.valueOf() ?? 0))] as const
				if (score[0] < bestScore[0] || (score[0] === bestScore[0] && score[1] < bestScore[1])) {
					bestScore = score
					best = { from, to }
				}
			}
		}
		return best
	}

	/** Checks if the dependent boundary occurs before the predecessor boundary. Undecidable cases
	 * (hierarchy, missing boundaries, unparsed lead/lag gaps) evaluate to false. */
	violatedBy(from: RelationEndpoint, to: RelationEndpoint) {
		const coupling = this.coupling
		if (!coupling || this.gap) {
			return false
		}
		const required = from.boundaryOf(coupling.from)
		const actual = to.boundaryOf(coupling.to)
		return !!required && !!actual && actual.valueOf() < required.valueOf()
	}
}
