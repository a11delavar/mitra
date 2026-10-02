import { Controller } from '@a11d/lit'
import { type ReactiveControllerHost } from 'lit'
import { type EntrySegment } from './EntrySegment.js'
import { EntryEditorIntent } from './EntryEditorIntent.js'

/** A surface an entry's editor opens from: the segment it draws, and whether its editor is open. */
export interface EntryEditorHost extends ReactiveControllerHost {
	readonly segment?: EntrySegment
	open: boolean
}

/**
 * Where an entry's editor opens, shared by every surface that draws one: it reports the editor's state to
 * {@link EntryEditorIntent}, and opens on a request for its entry, on the entry's first day only.
 */
export class EntryEditorAnchor extends Controller {
	/** What was last reported. A surface mounts closed, and reporting that would close an editor another day of the same entry has open. */
	private reported = false

	constructor(protected override readonly host: EntryEditorHost) {
		super(host)
	}

	/** A view that guards its templates re-renders nothing for a request, so the surface updates itself. */
	private readonly handleRequest = () => {
		const entry = this.host.segment?.entry
		if (entry && EntryEditorIntent.shouldOpen(entry)) {
			this.host.requestUpdate()
		}
	}

	override hostConnected() {
		EntryEditorIntent.requests.addEventListener('request', this.handleRequest)
	}

	override hostDisconnected() {
		EntryEditorIntent.requests.removeEventListener('request', this.handleRequest)
		const entry = this.host.segment?.entry
		if (this.reported && entry) {
			EntryEditorIntent.setEditing(entry, false)
			this.reported = false
		}
	}

	override hostUpdated() {
		const { segment, open } = this.host
		if (!segment) {
			return
		}
		if (open !== this.reported) {
			this.reported = open
			EntryEditorIntent.setEditing(segment.entry, open)
		}
		if (EntryEditorIntent.shouldOpen(segment.entry) && !segment.hasPrevious) {
			// Reported before the request is consumed, so no display lens drops the entry in between.
			EntryEditorIntent.setEditing(segment.entry, true)
			this.reported = true
			EntryEditorIntent.consume()
			this.host.open = true
		}
	}
}
