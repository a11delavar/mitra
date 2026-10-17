import { type Converter, deconstruct } from '@a11d/converter'
import { equals } from '@a11d/equals'
import { EntryFile } from './EntryFile.js'
import { EntryFileType } from './EntryFileType.js'

/** The files an entry carries, each as what it is to the entry (its type, an attachment if none is named), in order, each once per type, at most {@link maxCount} of a type. */
export class EntryFiles implements Iterable<EntryFile> {
	static readonly maxCount = 50

	/** The usable files among `values`, deduplicated, each ranked by its place among those of its type. Anything unusable is dropped, as participants are. */
	static of(values: unknown): EntryFiles {
		const byKey = new Map<string, EntryFile>()
		const counts = new Map<EntryFileType, number>()
		for (const value of values instanceof EntryFiles ? values.all : Array.isArray(values) ? values : []) {
			const file = EntryFile.from(value)
			if (!file) {
				continue
			}
			const type = file.type ?? EntryFileType.parse((value as { type?: unknown }).type) ?? EntryFileType.Attachment
			const rank = counts.get(type) ?? 0
			const key = `${type} ${file.key}`
			if (!byKey.has(key) && rank < EntryFiles.maxCount) {
				byKey.set(key, file.type === type && file.rank === rank ? file : file.as(type, rank))
				counts.set(type, rank + 1)
			}
		}
		return new EntryFiles([...byKey.values()])
	}

	/** The files' facts and types on the wire, absent while there are none. */
	static readonly converter: Converter<ReadonlyArray<object> | null | undefined, EntryFiles> = {
		construct: value => EntryFiles.of(value),
		deconstruct: files => !files.length ? undefined : files.all.map(file => deconstruct(file)),
	}

	private constructor(readonly all: ReadonlyArray<EntryFile>) { }

	get length() {
		return this.all.length
	}

	[Symbol.iterator]() {
		return this.all[Symbol.iterator]()
	}

	/** The one `href` points at ({@link EntryFile.isAt}). */
	at(href: string) {
		return this.all.find(file => file.isAt(href))
	}

	/** Those that are `type` to the entry, in their order. */
	ofType(type: EntryFileType) {
		return EntryFiles.of(this.all.filter(file => file.type === type).sort((a, b) => a.rank - b.rank))
	}

	/** These with those that are `type` replaced by `files`, as that type, in the order given. */
	replacing(type: EntryFileType, files: Iterable<EntryFile> | undefined) {
		return EntryFiles.of([...this.all.filter(file => file.type !== type), ...[...files ?? []].map((file, rank) => file.as(type, rank))])
	}

	/** These with `file` last among its type, unless it is already there. */
	adding(file: EntryFile) {
		return EntryFiles.of([...this.all, file])
	}

	/** These without `file`. */
	without(file: EntryFile) {
		return EntryFiles.of(this.all.filter(candidate => !file.refersTo(candidate)))
	}

	/** These with each that refers to one of `held` as that one ({@link EntryFile.resolve}): an `ATTACH` line naming one of Mitra's own files by its URL is that file. */
	resolvedAgainst(held: EntryFiles) {
		return EntryFiles.of(this.all.map(file => {
			const row = held.all.find(each => file.refersTo(each))
			return row ? file.clone().resolve(row) : file
		}))
	}

	/** The same files, as the same things, in the same order. A file's facts are its row's, so they don't tell two lists apart. */
	equals(other: EntryFiles | undefined) {
		return !!other && this.length === other.length && this.all.every((file, index) => file.key === other.all[index]!.key && file.type === other.all[index]!.type)
	}

	[equals](other: unknown) {
		return other instanceof EntryFiles && this.equals(other)
	}
}
