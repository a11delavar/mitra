import { Component, component, css, html, property } from '@a11d/lit'
import { marked, Renderer, type Tokens } from 'marked'

export class MarkdownRenderer extends Renderer {
	private static readonly calloutIcons = new Map<string, string>([
		['note', 'info'],
		['info', 'info'],
		['tip', 'lightbulb'],
		['success', 'circle-check'],
		['important', 'message-square-warning'],
		['warning', 'triangle-alert'],
		['caution', 'octagon-alert'],
		['danger', 'octagon-alert'],
		['error', 'octagon-alert'],
	])

	override heading(token: Tokens.Heading) {
		// Demote one level so embedded content never injects an <h1>.
		return super.heading({ ...token, depth: Math.min(token.depth + 1, 6) })
	}

	override link(token: Tokens.Link) {
		return super.link(token).replace('<a', '<a target="_blank" rel="noopener noreferrer"')
	}

	override blockquote(token: Tokens.Blockquote) {
		// GitHub/Obsidian callouts: a blockquote whose first line is `[!type] optional title`.
		const quote = this.parser.parse(token.tokens)
		const match = quote.match(/<p>\s*\[!(\w+)\]([^\n<]*)/i)
		if (!match) {
			return super.blockquote(token)
		}
		const type = match[1]!.toLowerCase()
		const title = match[2]!.trim() || type.charAt(0).toUpperCase() + type.slice(1)
		const icon = MarkdownRenderer.calloutIcons.get(type) ?? 'info'
		const body = quote.replace(/(<p>\s*)\[!\w+\][^\n<]*\n?/i, '$1')
		return `
			<mitra-markdown-callout data-type="${type}">
				<div class="callout-title">
					<mitra-icon icon="${icon}"></mitra-icon>
					${title}
				</div>
				${body}
			</mitra-markdown-callout>
		`
	}

	render(markdown: string) {
		// Rename every HTML tag to a `mitra-markdown-*` custom element. Unknown ones render inert
		// (so raw/unsafe HTML is neutralized); defining a `mitra-markdown-x` element opts into it.
		markdown = markdown
			.replaceAll(/<(?!\/)(.)([^>]+)>/g, '<mitra-markdown-$1$2>')
			.replaceAll(/<\/(.*)>/g, '</mitra-markdown-$1>')
		return marked.parse(markdown, { renderer: this, async: false })
	}
}

@component('mitra-markdown')
export class Markdown extends Component {
	@property() value = ''

	protected readonly renderer = new MarkdownRenderer()

	protected override createRenderRoot() { return this }

	static override get styles() {
		return css`
			mitra-markdown {
				display: block;
				color: var(--color-text);
				line-height: 1.6;
				overflow-wrap: break-word;
				main > :first-child { margin-block-start: 0; }
				main > :last-child { margin-block-end: 0; }

				h1, h2, h3, h4, h5, h6 {
					margin: 1.4em 0 0.5em;
					font-weight: 600;
					line-height: 1.3;
				}

				h1 { font-size: 1.5em; }
				h2 { font-size: 1.3em; }
				h3 { font-size: 1.15em; }
				h4, h5, h6 { font-size: 1em; }

				p {
					margin: 0.6em 0;
				}

				a {
					color: var(--color-accent);
					text-decoration: none;

					&:hover {
						text-decoration: underline;
					}
				}

				strong { font-weight: 600; }
				em { font-style: italic; }

				ul, ol {
					margin: 0.6em 0;
					padding-inline-start: 1.4em;
				}

				li {
					margin: 0.2em 0;
				}

				blockquote {
					margin: 0.8em 0;
					padding: 0.1em 0 0.1em 0.9em;
					border-inline-start: 3px solid color-mix(in srgb, var(--color-accent) 55%, transparent);
					color: var(--color-text-muted);
				}

				code {
					font-family: ui-monospace, 'Cascadia Code', monospace;
					font-size: 0.9em;
					background: color-mix(in srgb, var(--color-text) 8%, transparent);
					padding: 0.1em 0.35em;
					border-radius: var(--border-radius);
				}

				pre {
					margin: 0.8em 0;
					padding: 0.8em 1em;
					background: color-mix(in srgb, var(--color-text) 6%, transparent);
					border-radius: 8px;
					overflow-x: auto;

					code {
						padding: 0;
						background: none;
					}
				}

				hr {
					margin: 1.4em 0;
					border: 0;
					height: 1px;
					background: color-mix(in srgb, var(--color-text) 12%, transparent);
				}

				img {
					max-width: 100%;
					border-radius: 8px;
				}

				table {
					width: 100%;
					border-collapse: collapse;
					margin: 0.8em 0;
					font-size: 0.95em;
				}

				th, td {
					padding: 0.4em 0.7em;
					text-align: start;
					border-block-end: 1px solid color-mix(in srgb, var(--color-text) 10%, transparent);
				}

				th {
					font-weight: 600;
					background: color-mix(in srgb, var(--color-text) 6%, transparent);
				}

				tbody tr:last-child td {
					border-block-end: none;
				}

				/* GitHub/Obsidian callouts (emitted by the blockquote renderer). */
				mitra-markdown-callout {
					--callout-color: var(--color-accent);
					display: block;
					margin: 0.8em 0;
					padding: 0.5em 0.85em;
					border-inline-start: 3px solid var(--callout-color);
					border-radius: 6px;
					background: color-mix(in srgb, var(--callout-color) 9%, transparent);

					&[data-type=note], &[data-type=info] { --callout-color: #4c91f0; }
					&[data-type=tip], &[data-type=success] { --callout-color: #41b658; }
					&[data-type=important] { --callout-color: #9a6df0; }
					&[data-type=warning] { --callout-color: #e0992b; }
					&[data-type=caution], &[data-type=danger], &[data-type=error] { --callout-color: #e5534b; }

					> * { margin-block: 0.35em; }
					> :first-child { margin-block-start: 0; }
					> :last-child { margin-block-end: 0; }

					.callout-title {
						display: flex;
						align-items: center;
						gap: 0.4em;
						color: var(--callout-color);
						font-weight: 600;
					}
				}
			}
		`
	}

	protected override get template() {
		return html`<main .innerHTML=${this.renderer.render(this.value)}></main>`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-markdown': Markdown
	}
}
