/** What an instance says of itself, which the browser reads once it loads and again when it is stale. */
export interface InstanceMeta {
	/** The operator's `MITRA_NAME`, if any. */
	readonly name?: string
	readonly version: string
	readonly commit: string
	readonly node: string
	readonly development?: boolean
	readonly demo?: boolean
	readonly releaseUrl?: string
	readonly update?: { readonly version: string, readonly url: string, readonly commits?: number }
	/** The largest file in bytes (0 takes no uploads), and each account's total. */
	readonly files?: { readonly maxSize: number, readonly quota?: number }
	/** Whether people sign in, so an agent needs an access token. */
	readonly signIn?: boolean
	/** Whether agents may connect over MCP (`MITRA_MCP`). */
	readonly mcp?: boolean
}
