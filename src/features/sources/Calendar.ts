import type { Integration } from '#integrations'
import { type Source } from './Source.js'

/** A calendar as an entry lives in it: the source, and the integration that keeps it. */
export interface Calendar {
	readonly source: Source
	readonly integration: Integration
}
