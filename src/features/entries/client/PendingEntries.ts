import { type Entry } from '../Entry.js'

/** Who is told when the pending entries change: of where entries lie alone, or of the entries themselves. */
interface PendingEntriesObserver {
	moved(...entries: ReadonlyArray<Entry | undefined>): void
	changed(): void
}

/**
 * What a gesture lays over the stored entries: the draft being made, the entry a drag holds and its preview of where it
 * would land, and copies on their way to the server.
 */
export class PendingEntries {
	private currentDraft?: Entry
	private preview?: Entry
	private dragging?: Entry
	private readonly duplicates = new Set<Entry>()

	constructor(private readonly observer: PendingEntriesObserver) { }

	/** The entry being made, which has no id until it is saved. */
	get draft() { return this.currentDraft }

	/** What it lays over the stored entries: the copies in flight, the draft, and a preview that stands apart from what it drags. */
	get entries(): ReadonlyArray<Entry> {
		return [
			...this.duplicates,
			...(this.currentDraft ? [this.currentDraft] : []),
			...(this.shownPreview ? [this.shownPreview] : []),
		]
	}

	/** A drag only ever moves the span, so a ghost occupying the source's is a second copy of it, even when both are dateless. */
	private get shownPreview(): Entry | undefined {
		return this.preview && this.dragging && this.preview.span.equals(this.dragging.span) ? undefined : this.preview
	}

	upsertDraft(entry: Entry) {
		const previous = this.currentDraft
		this.currentDraft = entry
		this.observer.moved(previous, entry)
	}

	/** Drops a draft nothing was typed into. */
	discardDraft() {
		if (this.currentDraft?.blank) {
			this.currentDraft = undefined
			this.observer.changed()
		}
	}

	setDragging(entry: Entry | undefined) {
		if (this.dragging !== entry) {
			const previous = this.dragging
			this.dragging = entry
			this.observer.moved(previous, entry, this.preview)
		}
	}

	setPreview(entry: Entry | undefined) {
		// Re-notifies even for the same instance, which drags mutate in place; nothing to nothing can't.
		if (this.preview === undefined && entry === undefined) {
			return
		}
		const previous = this.preview
		this.preview = entry
		this.observer.moved(previous, entry, this.dragging)
	}

	/** Whether this exact preview is the one on screen. */
	previewing(entry: Entry) {
		return this.preview === entry
	}

	isDragging(entry: Entry) {
		return this.dragging === entry && this.preview === undefined
	}

	get dragSource(): Entry | undefined {
		return this.shownPreview === undefined ? undefined : this.dragging
	}

	isDragSource(entry: Entry) {
		return this.dragSource === entry
	}

	isPreview(entry: Entry) {
		return this.shownPreview !== undefined && this.shownPreview === entry
	}

	/** Holds `duplicate` until `saving` settles, so the copy shows while it is on its way. */
	async holding<T>(duplicate: Entry, saving: () => Promise<T>) {
		this.duplicates.add(duplicate)
		this.observer.changed()
		try {
			return await saving()
		} finally {
			this.duplicates.delete(duplicate)
			this.observer.changed()
		}
	}

	/** A draft that was saved is a stored entry now. */
	settled(entry: Entry) {
		if (this.currentDraft === entry) {
			this.currentDraft = undefined
		}
	}

	/** Lets go of `entry`, as the draft or the entry dragged, once it is gone. */
	forget(entry: Entry) {
		this.settled(entry)
		if (this.dragging === entry) {
			this.dragging = undefined
		}
	}

	reset() {
		this.duplicates.clear()
		this.currentDraft = undefined
		this.preview = undefined
		this.dragging = undefined
	}
}
