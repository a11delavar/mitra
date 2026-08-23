import type { Entry } from './Entry.js'
import type { EntryChange } from './EntryChange.js'
import { EntryPlan, type PlannedWrite, type SkippedEntry } from './EntryPlan.js'
import type { RelationEdge } from './RelationEdge.js'
import type { RelationGraph } from './RelationGraph.js'

/** Maximum relaxation passes to bound walks on cyclic or complex graphs. */
const MAX_PASSES = 50

const DAY = 24 * 60 * 60 * 1000

/** Why an entry a plan reached is left where it is. */
function skipReasonOf(entry: Entry): SkippedEntry['reason'] | undefined {
	if (entry.recurrence || entry.recurrenceMasterId) {
		return 'repeats'
	}
	return entry.start ? undefined : 'undated'
}

/** An all-day entry has no clock time to land on, so its shift rounds up to whole days. */
function roundedFor(entry: Entry, milliseconds: number) {
	return entry.allDay ? Math.ceil(milliseconds / DAY) * DAY : milliseconds
}

/**
 * Turns per-UID shifts into an EntryPlan, preserving predecessor order and carrying subtrees with
 * moved entries.
 */
function planOf(graph: RelationGraph, shifts: ReadonlyMap<string, number>): EntryPlan {
	const carried = new Map(shifts)
	for (const [uid, milliseconds] of shifts) {
		for (const descendant of graph.descendantsOf(uid)) {
			if (descendant.uid && !carried.has(descendant.uid)) {
				carried.set(descendant.uid, milliseconds)
			}
		}
	}

	const writes = new Array<PlannedWrite & { at: number }>()
	const skipped = new Array<SkippedEntry>()
	for (const [uid, milliseconds] of carried) {
		const entry = graph.entryOf(uid)
		if (!entry || !milliseconds) {
			continue // a dangling pointer moves nothing
		}
		const reason = skipReasonOf(entry)
		if (reason) {
			skipped.push({ entry, reason })
			continue
		}
		writes.push({
			entry,
			at: entry.start?.valueOf() ?? 0,
			effect: String(milliseconds),
			mutate: (target: Entry) => {
				target.start = target.start?.add({ milliseconds })
				target.end = target.end?.add({ milliseconds })
			},
		})
	}
	return EntryPlan.of({ writes: writes.sort((a, b) => a.at - b.at), skipped })
}

/**
 * Strategy defining how entry moves propagate to downstream dependents, producing an {@link EntryPlan}.
 */
export abstract class ShiftStrategy {
	/** Leave the dependents where they are. */
	static get None() { return instances.none }
	/** Move each dependent by the least that clears the coupling it broke. */
	static get Minimum() { return instances.minimum }
	/** Move every dependent by the same amount, preserving relative intervals. */
	static get Maintain() { return instances.maintain }

	/** All strategies in default prompt order. */
	static get all(): ReadonlyArray<ShiftStrategy> { return [instances.none, instances.minimum, instances.maintain] }

	abstract readonly value: string
	abstract readonly icon: string
	abstract format(): string
	abstract plan(graph: RelationGraph, change: EntryChange): EntryPlan
}

class NoShift extends ShiftStrategy {
	override readonly value = 'none'
	override readonly icon = 'calendar'
	override format() { return t('Only this entry') }
	override plan() { return EntryPlan.empty }
}

/**
 * Minimum shift strategy: moves each dependent by the smallest offset required to resolve broken
 * couplings, allowing links with slack to absorb the cascade.
 */
class MinimumShift extends ShiftStrategy {
	override readonly value = 'minimum'
	override readonly icon = 'waypoints'
	override format() { return t('Keep the chain intact') }

	override plan(graph: RelationGraph, change: EntryChange): EntryPlan {
		const moved = change.entry.uid
		if (!moved) {
			return EntryPlan.empty
		}
		const shifts = new Map<string, number>()
		const at = (uid: string, boundary: { valueOf(): number }) => boundary.valueOf() + (shifts.get(uid) ?? 0)
		const deficitOf = (edge: RelationEdge, dependent: Entry) => {
			const predecessor = graph.entryOf(edge.from)
			const current = edge.coupling && dependent.boundaryOf(edge.coupling.to)
			const required = predecessor && edge.requiredBoundaryOf(predecessor)
			return !predecessor || !current || !required ? 0 : at(edge.from, required) - at(edge.to, current)
		}
		const move = (entry: Entry, milliseconds: number) => {
			shifts.set(entry.uid!, (shifts.get(entry.uid!) ?? 0) + milliseconds)
		}

		const downstream = graph.downstreamOf(moved)
		const upstream = graph.upstreamOf(moved)
		for (let pass = 0; pass < MAX_PASSES; pass++) {
			let moving = false

			// Forwards: move downstream dependents by deficit to clear broken couplings.
			for (const node of downstream) {
				const edges = graph.edgesTo(node.uid!).filter(edge => edge.family === 'dependency')
				if (!edges.some(edge => edge.from === moved || shifts.has(edge.from))) {
					continue
				}
				const deficit = Math.max(0, ...edges.map(edge => deficitOf(edge, node)))
				if (deficit > 0) {
					move(node, roundedFor(node, deficit))
					moving = true
				}
			}

			// Backwards: shift predecessors earlier if placed before their required boundaries.
			for (const node of [change.entry, ...upstream]) {
				if (node.uid !== moved && !shifts.has(node.uid!)) {
					continue
				}
				for (const edge of graph.edgesTo(node.uid!)) {
					const predecessor = edge.family === 'dependency' && edge.from !== moved ? graph.entryOf(edge.from) : undefined
					const deficit = predecessor ? deficitOf(edge, node) : 0
					if (predecessor && deficit > 0) {
						move(predecessor, -roundedFor(predecessor, deficit))
						moving = true
					}
				}
			}

			if (!moving) {
				break
			}
		}
		return planOf(graph, shifts)
	}
}

/**
 * Maintain strategy: shifts the entire dependency chain by the same delta offset to preserve intervals.
 */
class MaintainGap extends ShiftStrategy {
	override readonly value = 'maintain'
	override readonly icon = 'chevrons-right'
	override format() { return t('Move them all by the same amount') }

	override plan(graph: RelationGraph, change: EntryChange): EntryPlan {
		const moved = change.entry.uid
		const delta = change.delta
		return !moved || !delta
			? EntryPlan.empty
			: planOf(graph, new Map([...graph.upstreamOf(moved), ...graph.downstreamOf(moved)].map(entry => [entry.uid!, delta])))
	}
}

// Below the subclasses, because a static initializer would run before they exist.
const instances = { none: new NoShift(), minimum: new MinimumShift(), maintain: new MaintainGap() }
