import { Component, component, html, css, property, state, event, query, repeat } from '@a11d/lit'
import { File } from '#features/files/File.js'
import { uploadFile } from '#infrastructure/http/Api.js'
import { session } from '#infrastructure/http/PageSession.js'
import { type EntryFile } from '../EntryFile.js'
import { type Entry } from '../Entry.js'
import { EntryStore, reportSaveError } from './EntryStore.js'

/** A file on its way up to `entry`, keyed as its row will be once it is in, so the row keeps its element and never animates in twice. */
interface Upload {
	readonly entry: Entry
	readonly file: globalThis.File
	readonly key: string
}

/** A row of the list: a file the entry carries, one just removed and still animating out, or one uploading. */
interface Row {
	readonly key: string
	readonly file?: EntryFile
	readonly leaving?: boolean
	readonly pending?: globalThis.File
}

let unhashed = 0

/**
 * Entry editor attachments row: the files on an entry, uploaded or removed. Links are not added here: they
 * are a reading of the description, written where they are read (the Links row).
 */
@component('mitra-attachments-field')
export class AttachmentsField extends Component {
	@property({
		type: Object,
		// A fresh copy of the same entry, as its save comes back, keeps what is in flight; only another entry starts over.
		updated(this: AttachmentsField, entry: Entry, previous?: Entry) {
			if (!previous || !AttachmentsField.same(entry, previous)) {
				this.failure = undefined
				this.leaving = []
			}
		},
	}) entry!: Entry

	@event() readonly change!: EventDispatcher

	/** A saved or synced entry is changed in place, so the rows learn of its files from the store, not from a new `entry`. */
	readonly store = new EntryStore(this, { entry: () => this.entry })

	@state() private uploading: ReadonlyArray<Upload> = []
	/** How many of the user's own changes still move rows: only those animate, never the rows an opening editor shows. */
	@state() private moving = 0
	/** Files just removed, kept where they stood until their row has animated out. */
	@state() private leaving: ReadonlyArray<{ readonly file: EntryFile, readonly index: number }> = []
	@state() private failure?: string

	protected override createRenderRoot() { return this }

	@query('input[type=file]') private readonly filePicker?: HTMLInputElement

	private readonly embedFile = (file: EntryFile) => {
		this.entry.embed(file, location.origin)
		this.changed()
	}

	/** Whether this instance takes uploads at all: off when its size limit is zero, as on the public demo. */
	static get uploads() {
		return session.instance.files?.maxSize !== 0
	}

	private get canUpload() {
		return this.entry.canEdit('attachments') && AttachmentsField.uploads
	}

	protected override updated(...parameters: Parameters<Component['updated']>) {
		super.updated(...parameters)
		this.toggleAttribute('data-animated', this.moving > 0)
	}

	/** Runs one of the user's changes with the rows' motion on, until the rows it moved have settled. */
	private async move(change: () => Promise<void>) {
		this.moving++
		// On before the render that moves the rows: a style taken in between would set them moved without a transition.
		this.toggleAttribute('data-animated', true)
		try {
			await change()
		} finally {
			await this.settled()
			this.moving--
		}
	}

	/** Once the rows have rendered and stopped moving. A save waits for it: it re-renders the calendar behind on the thread the rows move on. */
	private async settled() {
		await this.updateComplete
		// Transitions only: they always end, where an endless animation inside (a spinner) would hold the save forever.
		await Promise.allSettled(this.getAnimations({ subtree: true }).filter(animation => animation instanceof CSSTransition).map(animation => animation.finished))
	}

	private changed() {
		this.requestUpdate()
		this.change.dispatch()
	}

	private readonly pickFiles = () => {
		this.failure = undefined
		this.filePicker?.click()
	}

	/** Whether two instances stand for the same entry: the editor is handed a fresh one whenever the entry comes back from the server. */
	private static same(entry: Entry | undefined, other: Entry | undefined) {
		return entry === other || (!!entry && entry.id !== undefined && entry.id === other?.id)
	}

	/** The SHA-256 of a file's bytes, the key its row will have; none where the page has no Web Crypto (plain HTTP off localhost). */
	private static async keyOf(file: globalThis.File) {
		try {
			const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
			return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
		} catch {
			return undefined
		}
	}

	/**
	 * Uploads `files` and attaches each, as the add button does; the editor hands it the files dropped on it. A file the entry
	 * already carries is skipped before it uploads. They upload at once and attach in the order given, each as soon as it and those
	 * before it are in, to the entry they were given for, even once the editor shows another.
	 */
	readonly upload = async (files: Iterable<globalThis.File> | null) => {
		const entry = this.entry
		this.failure = undefined
		const maxSize = session.instance.files?.maxSize
		const accepted = [...files ?? []].filter(file => {
			const fits = maxSize === undefined || file.size <= maxSize
			if (!fits) {
				this.failure = t('${name} is larger than the ${limit} limit', { name: file.name, limit: File.formatSize(maxSize) ?? '' })
			}
			return fits
		})
		const held = new Set([...entry.attachments.all, ...this.leaving.map(({ file }) => file)].map(file => file.key).concat(this.uploading.map(upload => upload.key)))
		const fresh = new Array<Upload>()
		for (const file of accepted) {
			const key = await AttachmentsField.keyOf(file) ?? `unhashed ${++unhashed}`
			if (!held.has(key)) {
				held.add(key)
				fresh.push({ entry, file, key })
			}
		}
		if (fresh.length) {
			await this.move(() => this.send(fresh))
		}
	}

	private async send(fresh: ReadonlyArray<Upload>) {
		this.uploading = [...this.uploading, ...fresh]
		const uploads = fresh.map(upload => {
			const uploaded = uploadFile(upload.file)
			// Awaited in order below; a later one failing first must not surface as an unhandled rejection meanwhile.
			uploaded.catch(() => void 0)
			return [upload, uploaded] as const
		})
		for (const [upload, uploaded] of uploads) {
			try {
				const file = await uploaded
				this.uploading = this.uploading.filter(other => other !== upload)
				const entry = AttachmentsField.same(upload.entry, this.entry) ? this.entry : upload.entry
				entry.attachments = entry.attachments.adding(file)
				await this.settled()
				this.saved(entry)
			} catch (error: unknown) {
				this.uploading = this.uploading.filter(other => other !== upload)
				this.failure = error instanceof Error ? error.message : t('This file could not be uploaded')
			}
		}
	}

	/** Saves `entry`: through the editor while it shows that entry, else directly, as the editor has moved on. */
	private saved(entry: Entry) {
		if (entry === this.entry) {
			this.changed()
		} else {
			EntryStore.commit(entry).catch(reportSaveError)
		}
	}

	/** Takes `file` off the entry at once; its row stays where it stood until it has animated out, and only then is the entry saved (settled()). */
	private readonly removeAttachment = (file: EntryFile) => this.move(async () => {
		const entry = this.entry
		const index = entry.attachments.all.findIndex(each => each.key === file.key)
		entry.detach(file)
		this.leaving = [...this.leaving, { file, index }]
		await this.updateComplete
		const row = [...this.querySelectorAll<HTMLElement>(':scope > .attachment[data-leaving]')].find(each => each.dataset.key === file.key)
		await Promise.allSettled(row?.getAnimations().map(animation => animation.finished) ?? [])
		// A fresh copy of the entry arriving meanwhile doesn't know of the removal yet.
		const current = AttachmentsField.same(entry, this.entry) ? this.entry : entry
		current.detach(file)
		this.leaving = this.leaving.filter(each => each.file !== file)
		this.saved(current)
	})

	private get rows(): ReadonlyArray<Row> {
		const leaving = new Set(this.leaving.map(({ file }) => file.key))
		const rows: Array<Row> = this.entry.attachments.all.filter(file => !leaving.has(file.key)).map(file => ({ key: file.key, file }))
		for (const { file, index } of [...this.leaving].sort((a, b) => a.index - b.index)) {
			rows.splice(Math.min(index, rows.length), 0, { key: file.key, file, leaving: true })
		}
		return [...rows, ...this.uploading.filter(upload => AttachmentsField.same(upload.entry, this.entry)).map(upload => ({ key: upload.key, pending: upload.file }))]
	}

	static override get styles() {
		return css`
			mitra-attachments-field {
				grid-column: 2;
				min-width: 0;
				/* As the reminders row: the files stack in the first column; the add button holds the END of the first line,
				   so it stays put as the list below it grows. */
				display: grid;
				grid-template-columns: minmax(0, 1fr) auto;
				align-items: center;
				/* The rows' spacing is their own padding, never a gap: a gap can't collapse with a row leaving. */
				--_spacing: 0.0625rem;
				padding-block: calc(0.25rem - var(--_spacing));

				> :is(.placeholder, .attachment, .failure) {
					grid-column: 1;
					padding-block: var(--_spacing);
				}

				> .add {
					grid-column: 2;
					grid-row: 1;
					color: var(--color-text-muted);
					margin-block: -0.25rem;
				}

				> .placeholder {
					all: unset;
					grid-column: 1;
					padding-block: var(--_spacing);
					cursor: pointer;
					color: var(--color-text-muted);
				}

				> .attachment {
					display: flex;
					align-items: center;
					gap: 0.25rem;
					min-width: 0;
					/* A row folds away as it leaves; the clip margin keeps the remove button whole meanwhile. */
					interpolate-size: allow-keywords;
					overflow: clip;
					overflow-clip-margin: 0.25rem;

					&[data-leaving] {
						block-size: 0;
						padding-block: 0;
						translate: 0 -0.25rem;
						opacity: 0;
					}

					> a, > .pending {
						flex: 1;
						min-width: 0;
						display: flex;
						align-items: center;
						gap: 0.5rem;
						color: inherit;
						text-decoration: none;

						> mitra-icon {
							flex-shrink: 0;
							color: var(--color-text-muted);
						}

						> .name {
							overflow: hidden;
							text-overflow: ellipsis;
							white-space: nowrap;
						}

						> .size {
							flex-shrink: 0;
							font-size: 0.6875rem;
							color: var(--color-text-muted);
						}
					}

					> a:hover > .name {
						text-decoration: underline;
					}

					> .pending {
						color: var(--color-text-muted);
					}

					> mitra-icon-button {
						color: var(--color-text-muted);
						margin-block: -0.25rem;
						opacity: 0;
						transition: opacity 0.15s ease;
					}

					&:hover > mitra-icon-button,
					> mitra-icon-button:focus-within {
						opacity: 1;
					}

					@media (pointer: coarse) {
						> mitra-icon-button {
							opacity: 1;
						}
					}
				}

				> .failure {
					font-size: 0.6875rem;
					color: var(--color-error);
				}

				/* Rows move only for what the user does (move()): an opening editor shows its rows as they are. */
				&[data-animated] > .attachment {
					transition:
						block-size 0.2s cubic-bezier(0.4, 0, 0.2, 1),
						padding-block 0.2s cubic-bezier(0.4, 0, 0.2, 1),
						translate 0.2s cubic-bezier(0.4, 0, 0.2, 1),
						opacity 0.2s ease;

					@starting-style {
						block-size: 0;
						padding-block: 0;
						translate: 0 -0.25rem;
						opacity: 0;
					}

					@media (prefers-reduced-motion: reduce) {
						transition: none;
					}
				}
			}
		`
	}

	protected override get template() {
		if (!this.entry) {
			return html.nothing
		}
		const rows = this.rows
		return html`
			${rows.length ? html.nothing : html`
				<button class="placeholder" @click=${this.pickFiles}>${t('Attachments')}</button>
			`}
			${repeat(rows, row => row.key, row => this.rowTemplate(row))}
			${!this.failure ? html.nothing : html`<div class="failure">${this.failure}</div>`}
			${!this.canUpload ? html.nothing : this.addTemplate}
		`
	}

	/** One element per row, whatever it shows, so an upload turns into its file in place. */
	private rowTemplate({ key, file, leaving, pending }: Row) {
		const size = File.formatSize(file?.size)
		return html`
			<div class="attachment" data-key=${key} ?data-leaving=${leaving} ?inert=${leaving}>
				${pending ? html`
					<span class="pending">
						<mitra-icon icon="upload"></mitra-icon>
						<span class="name">${pending.name}</span>
						<span class="size">${t('Uploading…')}</span>
					</span>
				` : html`
					<a href=${file!.url()} target="_blank" rel="noopener noreferrer">
						<mitra-icon icon=${file!.icon}></mitra-icon>
						<span class="name">${file!.displayName}</span>
						${!size ? html.nothing : html`<span class="size">${size}</span>`}
					</a>
				`}
				${!this.entry.canEdit('description') || pending || leaving || this.entry.embeds(file!) ? html.nothing : html`
					<mitra-icon-button size="small" label=${t('Show in description')} icon=${file!.mimeType?.type === 'image' ? 'image' : 'link'} @click=${() => this.embedFile(file!)}></mitra-icon-button>
				`}
				${!this.entry.canEdit('attachments') || pending || leaving ? html.nothing : html`
					<mitra-icon-button size="small" label=${t('Remove attachment')} icon="x" @click=${() => this.removeAttachment(file!)}></mitra-icon-button>
				`}
			</div>
		`
	}

	private get addTemplate() {
		return html`
			<input type="file" multiple hidden
				@change=${(e: Event) => {
					// The pick itself changes nothing yet: let it reach the editor and it commits a clean entry, which
					// leaves EntryStore holding a settled commit that swallows the real save after the upload.
					e.stopPropagation()
					const input = e.target as HTMLInputElement
					void this.upload(input.files).finally(() => input.value = '')
				}}>
			<mitra-icon-button size="small" class="add" label=${t('Add attachment')} icon="plus" @click=${this.pickFiles}></mitra-icon-button>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-attachments-field': AttachmentsField
	}
}
