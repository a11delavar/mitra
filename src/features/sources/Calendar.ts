import { type Source } from './Source.js'
import { type Integration } from '../../integrations/Integration.js'

/** A calendar as an entry lives in it: the source, and the integration that keeps it. */
export interface Calendar {
	readonly source: Source
	readonly integration: Integration
}
