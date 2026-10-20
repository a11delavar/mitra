import { converter } from '@a11d/converter'
import { entity, primaryKey, property, index, Entity, identity, equality } from '#infrastructure/model'
import { MimeType } from './MimeType.js'

/** Base64url of 16 random bytes: the id, which is the capability that stands in for a sign-in on the serving route. */
const idPattern = '[A-Za-z0-9_-]{22}'

const ownPath = new RegExp(`(?:^|^https?://[^/]+)/api/files/(${idPattern})(?:/[^/?#]*)?/?(?:[?#].*)?$`)

/**
 * A file, as iCalendar's `ATTACH` (RFC 5545 §3.8.1.1) refers to one: bytes Mitra holds (`sha256`, under `data/files/<user>/<sha256>`),
 * or bytes anywhere else (`sourceUrl`), with what is known about them. The shape and behavior alone: each place that holds files
 * (an entry's `EntryFile`) is a table of its own, so a file is a fact of what carries it and goes with it. It is its row (`id`);
 * a reference, from a request or an `ATTACH` line, names one in other ways ({@link refersTo}) and is resolved to it ({@link resolve}).
 */
@entity({ abstract: true })
export abstract class File extends Entity {
	/**
	 * A file from untrusted data: Mitra's own by its hash, another's by its URL, with a well-formed id when one is given. A URL Mitra
	 * cannot interpret is kept as it is: it still belongs to the provider, and dropping it would delete its line on the next write.
	 */
	static from<T extends File>(this: new () => T, value: unknown): T | undefined {
		if (value instanceof this) {
			return value
		}
		if (typeof value !== 'object' || value === null) {
			return undefined
		}
		const candidate = value as Record<'id' | 'sourceUrl' | 'sha256' | 'name' | 'mimeType' | 'size', unknown>
		const text = (field: unknown, length: number) => typeof field === 'string' ? field.trim().slice(0, length) || undefined : undefined
		const sourceUrl = text(candidate.sourceUrl, 2000)
		const sha256 = sourceUrl ? undefined : text(candidate.sha256, 64)?.toLowerCase()
		const id = text(candidate.id, 64)
		if ((!sourceUrl && !sha256 && !id) || (sha256 && !/^[0-9a-f]{64}$/.test(sha256)) || (id && !new RegExp(`^${idPattern}$`).test(id))) {
			return undefined
		}
		const size = typeof candidate.size === 'number' && Number.isFinite(candidate.size) && candidate.size >= 0 ? Math.round(candidate.size) : undefined
		return Object.assign(new this(), {
			...id ? { id } : {},
			...sourceUrl ? { sourceUrl } : { sha256 },
			name: text(candidate.name, 255),
			mimeType: MimeType.parse(candidate.mimeType),
			size,
		})
	}

	/** The id in one of Mitra's own file URLs, matched by path, never origin. */
	static idOf(url: string): string | undefined {
		return ownPath.exec(url.trim())?.[1]
	}

	/** The name from a `Content-Disposition`, the RFC 5987 form first, without path separators or control characters: it is data, never a path. */
	static nameFrom(disposition: string | undefined): string {
		const encoded = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(disposition ?? '')?.[1]
		let name: string | undefined
		try {
			name = encoded ? decodeURIComponent(encoded.trim()) : undefined
		} catch {
			name = undefined
		}
		name ??= /filename\s*=\s*"([^"]*)"/.exec(disposition ?? '')?.[1] ?? /filename\s*=\s*([^;]+)/.exec(disposition ?? '')?.[1]?.trim()
		// eslint-disable-next-line no-control-regex
		return (name ?? '').replace(/[\u0000-\u001F\u007F/\\]/g, '').trim().slice(0, 255) || 'file'
	}

	/** A byte count in the reader's units. */
	static formatSize(bytes: number | undefined): string | undefined {
		if (bytes === undefined || !Number.isFinite(bytes)) {
			return undefined
		}
		const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const
		const magnitude = bytes < 1 ? 0 : Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
		const value = bytes / 1024 ** magnitude
		return new Intl.NumberFormat(Localizer.locales.current, {
			style: 'unit',
			unit: units[magnitude],
			unitDisplay: 'narrow',
			maximumFractionDigits: magnitude === 0 || value >= 100 ? 0 : 1,
		}).format(value)
	}

	/** Minted by the code, never the database, so a file is addressable from the moment it is uploaded. */
	static mintId() {
		const bytes = crypto.getRandomValues(new Uint8Array(16))
		return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
	}

	@identity()
	@primaryKey({ type: 'string' }) id: string = File.mintId()
	/** Whose bytes these are, for one of Mitra's own; none for another's, which has none. What carries the file deletes the row, so no key to the user is needed. */

	@equality()
	@converter({ out: {} })
	@index()
	@property({ type: 'string', nullable: true }) userId?: string

	@equality()
	@property({ type: 'string', nullable: true }) sourceUrl?: string

	@equality()
	@property({ type: 'string', nullable: true }) sha256?: string

	@equality()
	@property({ type: 'string', nullable: true }) name?: string

	@equality()
	@converter(MimeType.converter)
	@property({ type: MimeType.Mapper, nullable: true }) mimeType?: MimeType

	@equality()
	@property({ type: 'number', nullable: true }) size?: number

	@converter({ out: {} })
	@property({ type: 'Date' }) createdAt = new Date()

	constructor(init?: Partial<File>) {
		super()
		Object.assign(this, init)
	}

	/** What it is told apart by: the URL of another's file, the hash of Mitra's own, else the id it was referred to by. */
	get key() {
		return this.sourceUrl ?? this.sha256 ?? this.id
	}

	/** Whether `href` points at this file: at its address, or at one of Mitra's own URLs naming its id, whatever the host. */
	isAt(href: string) {
		const id = File.idOf(href)
		return this.sourceUrl === href || (id !== undefined && this.id === id)
	}

	/** Whether this, as a reference, names `file`: by its id, by what it is told apart by, or by one of Mitra's own URLs naming its id. */
	refersTo(file: File) {
		return this.id === file.id || this.key === file.key || (!!this.sourceUrl && File.idOf(this.sourceUrl) === file.id)
	}

	/** Makes this reference the file `held` is: its row and its bytes, which a reference never chooses, with the name, type and size it tells. */
	resolve(held: File) {
		this.id = held.id
		this.userId = held.userId
		this.sourceUrl = held.sourceUrl
		this.sha256 = held.sha256
		this.name ??= held.name
		this.mimeType ??= held.mimeType
		this.size ??= held.size
		return this
	}

	/** Same-origin path of a file Mitra holds; none for another's. */
	get path() {
		return this.sourceUrl ? undefined : `/api/files/${this.id}/${encodeURIComponent(this.name || 'file')}`
	}

	/** Its address; one of Mitra's own takes `origin`, as the readers of an `ATTACH` line know nothing of Mitra's host. */
	url(origin?: string) {
		const path = this.path
		return !path ? this.sourceUrl! : !origin ? path : `${origin.replace(/\/+$/, '')}${path}`
	}

	/** Its name, else the URL's last segment: a name is optional everywhere. */
	get displayName(): string {
		if (this.name) {
			return this.name
		}
		if (!this.sourceUrl) {
			return 'file'
		}
		try {
			const url = new URL(this.sourceUrl)
			return decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || url.hostname)
		} catch {
			return this.sourceUrl
		}
	}

	/** Its glyph: its type's, a link for a bare URL, a file for the unknown. */
	get icon() {
		return this.mimeType?.icon ?? (this.sourceUrl ? 'link' : 'file')
	}

	/** The `Content-Disposition` it is served with: shown in place where its type allows, else downloaded, named both ways so every client reads one. */
	get disposition() {
		const name = this.name || 'file'
		const ascii = name.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_')
		return `${this.mimeType?.inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`
	}
}
