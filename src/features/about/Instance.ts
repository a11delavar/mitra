import { model } from '#infrastructure/model'

/** What an instance says of itself (`GetMeta`), which the browser reads once it loads and again when it is stale. */
@model('Instance')
export class Instance {
	/** The operator's `MITRA_NAME`, if any. */
	name?: string
	version!: string
	commit!: string
	node?: string
	development?: boolean
	demo?: boolean
	releaseUrl?: string
	update?: { readonly version: string, readonly url: string, readonly commits?: number }
	/** The largest file in bytes (0 takes no uploads), and each account's total. */
	files?: { readonly maxSize: number, readonly quota?: number }
	/** Whether people sign in, so an agent needs an access token. */
	signIn?: boolean
	/** Whether agents may connect over MCP (`MITRA_MCP`). */
	mcp?: boolean

	constructor(init?: Partial<Instance>) {
		Object.assign(this, init)
	}

	/** The operator's name, else Mitra's own in the current language. */
	get displayName() {
		return this.name ?? String(t('Mitra'))
	}

	/** Whether the server runs another release than this page, which a reload catches up with. */
	get stale() {
		return this.version !== mitra.version
	}
}
