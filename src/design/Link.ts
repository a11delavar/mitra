import { Component, component, css, html, property } from '@a11d/lit'
import { ring } from './focusRing.css.js'
import './Icon.js'

/**
 * A link shown by what it leads to: a glyph for its kind, and its words, or for a link without words its
 * destination's (a web page by host and path, as browsers display it). A web page opens in a new tab;
 * anything else is handed to its app by the click itself, the user gesture browsers require.
 */
@component('mitra-link')
export class Link extends Component {
	/** Meeting services by the addresses of their calls, not by every page they serve: a Zoom profile is not a call. */
	private static readonly meetings = new Map([
		['Zoom', /^(https?:\/\/([\w-]+\.)?zoom(gov)?\.us\/(j|w|my|s)\/|zoom(mtg|us):)/],
		['Google Meet', /^https:\/\/meet\.google\.com\/./],
		['Microsoft Teams', /^(https:\/\/teams\.(microsoft\.com\/l\/meetup-join|live\.com\/meet)\/|msteams:)/],
		['Webex', /^https:\/\/([\w-]+\.)?webex\.com\/./],
		['Jitsi Meet', /^https:\/\/(meet\.jit\.si|8x8\.vc)\/./],
		['Whereby', /^https:\/\/whereby\.com\/./],
		['FaceTime', /^(https:\/\/facetime\.apple\.com\/join|facetime:)/],
		['Skype', /^https:\/\/join\.skype\.com\//],
	])

	/** Apps by the scheme of their links. A web page cannot ask which app owns a scheme, so this table names it. */
	private static readonly apps = new Map([
		['obsidian', 'Obsidian'], ['notion', 'Notion'], ['slack', 'Slack'], ['linear', 'Linear'], ['figma', 'Figma'],
		['things', 'Things'], ['omnifocus', 'OmniFocus'], ['bear', 'Bear'], ['craftdocs', 'Craft'], ['drafts', 'Drafts'],
		['x-devonthink-item', 'DEVONthink'], ['evernote', 'Evernote'], ['onenote', 'OneNote'],
		['vscode', 'Visual Studio Code'], ['vscode-insiders', 'Visual Studio Code'], ['cursor', 'Cursor'], ['spotify', 'Spotify'],
	])

	@property() href = ''
	/** In the text's own colour until hovered, for a row such as the location, where an accent would shout. */
	@property({ type: Boolean, reflect: true }) plain = false

	static override get styles() {
		return css`
			:host {
				display: inline;
			}

			/* A link without words is one unit with its glyph (a line never breaks between them), yet a long address still wraps inside it. */
			:host(:empty) a {
				display: inline-block;
				max-inline-size: 100%;
				overflow-wrap: anywhere;
			}

			a {
				color: var(--color-accent);
				text-decoration: none;
				border-radius: var(--border-radius);

				&:hover {
					text-decoration: underline;
				}

				&:focus-visible {
					${ring};
				}
			}

			mitra-icon {
				font-size: 0.9em;
				vertical-align: -0.125em;
				margin-inline-end: 0.25em;
			}

			:host([plain]) {
				a {
					color: var(--color-text);

					&:hover {
						color: var(--color-accent);
					}
				}

				a:not(:hover) mitra-icon {
					color: var(--color-text-muted);
				}
			}
		`
	}

	static appearanceOf(url: URL) {
		const meeting = [...Link.meetings].find(([, address]) => address.test(url.href))?.[0]
		if (meeting) {
			const join = String(t('Join ${service}', { service: meeting }))
			return { icon: 'video', label: join, title: join }
		}
		const app = Link.apps.get(url.protocol.slice(0, -1))
		if (app) {
			return { icon: 'square-arrow-out-up-right', label: Link.obsidianNoteOf(url) ?? app, title: String(t('Open in ${provider}', { provider: app })) }
		}
		switch (url.protocol) {
			case 'http:':
			case 'https:':
				return { icon: 'globe', label: `${url.hostname.replace(/^www\./, '')}${Link.decoded(url.pathname).replace(/\/+$/, '')}` }
			case 'mailto:':
				return { icon: 'mail', label: Link.decoded(url.pathname) }
			case 'tel:':
				return { icon: 'phone', label: Link.decoded(url.pathname) }
			default:
				return { icon: 'square-arrow-out-up-right', label: url.href }
		}
	}

	/** An Obsidian link names its note by vault path; the note is called by the path's last segment. */
	private static obsidianNoteOf(url: URL) {
		const shorthand = url.hostname === 'vault' ? url.pathname.split('/').slice(2).join('/') : undefined
		const path = url.protocol !== 'obsidian:' ? undefined : url.searchParams.get('file') ?? url.searchParams.get('filepath') ?? shorthand
		return Link.decoded(path?.split('/').at(-1) ?? '').replace(/\.md$/i, '') || undefined
	}

	private static decoded(text: string) {
		try {
			return decodeURIComponent(text)
		} catch {
			return text
		}
	}

	protected override get template() {
		const url = URL.parse(this.href, location.href)
		if (!url) {
			return html`<slot></slot>`
		}
		const { icon, label, title } = Link.appearanceOf(url)
		const web = url.protocol === 'http:' || url.protocol === 'https:'
		// Built from parts: whitespace between the anchor's tags would render inside it, underlined.
		const content = [html`<mitra-icon icon=${icon}></mitra-icon>`, html`<slot>${label}</slot>`]
		return html`<a href=${this.href} title=${title ?? this.href} rel="noopener noreferrer" target=${web ? '_blank' : '_self'}>${content}</a>`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-link': Link
	}
}
