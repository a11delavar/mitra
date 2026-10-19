import { html } from '@a11d/lit'
import { Setting, setting, type SettingStorage } from '../../settings/client/Setting.js'
import { getMeta } from '../../../infrastructure/http/Api.js'
import './McpConnection.js'

/** Where AI tools connect to the calendars (MCP), and the access tokens they connect with. Nothing here is a preference. */
@setting()
export class McpSetting extends Setting<undefined> {
	readonly heading = t('AI connectors')
	readonly icon = 'bot'
	readonly keywords = t('McpSetting.Keywords')
	readonly page = 'ai'
	readonly fallback = undefined

	protected readonly storage: SettingStorage<undefined> = { read: () => undefined, write: () => undefined }

	/** The operator can turn agents off (`MITRA_MCP`), and the demo never takes them. */
	override get applies() { return getMeta()?.mcp !== false && !getMeta()?.demo }

	override get hint() {
		return t('Claude, Cursor and other AI tools can read and change your calendars through this address, over the Model Context Protocol (MCP).')
	}

	override get control() {
		return html``
	}

	override get details() {
		return html`<mitra-mcp-connection></mitra-mcp-connection>`
	}
}
