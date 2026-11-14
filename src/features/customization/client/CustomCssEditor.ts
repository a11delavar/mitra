import { Component, component, css, html, live, property, state, type PropertyValues } from '@a11d/lit'
import { fieldChrome } from '#design/fieldChrome.css.js'
import { docsPage } from '#features/about/client/website.js'
import { CustomCss } from './CustomCss.js'

/** A stylesheet as text, the account's or the instance's: the page wears it as it is typed, and it is saved a moment after typing stops. */
@component('mitra-custom-css-editor')
export class CustomCssEditor extends Component {
	@property({ type: Object }) stylesheet!: CustomCss
	@property() label = ''

	@state() private css = ''

	private previewTimer?: ReturnType<typeof setTimeout>
	private saveTimer?: ReturnType<typeof setTimeout>

	protected override createRenderRoot() { return this }

	static override get styles() {
		return css`
			mitra-custom-css-editor {
				display: flex;
				flex-direction: column;
				gap: 0.375rem;
				padding-block: 0.75rem 0.625rem;
				padding-inline-start: calc(1.375rem + 0.875rem);

				textarea {
					${fieldChrome};
					field-sizing: content;
					/* Six lines and its padding, so a short stylesheet still sits in an editor. */
					min-block-size: calc(6lh + 1rem);
					padding: 0.5rem 0.625rem;
					resize: none;
					color: var(--color-text);
					font-family: ui-monospace, 'Cascadia Code', monospace;
					font-size: 0.75rem;
					line-height: 1.5;
					tab-size: 4;
					white-space: pre;
				}

				.status {
					margin: 0;
					font-size: 0.75rem;
					color: var(--color-text-muted);

					a {
						color: var(--color-text);
						text-decoration: underline;
						text-underline-offset: 3px;
						text-decoration-color: color-mix(in srgb, currentColor 35%, transparent);

						&:hover {
							text-decoration-color: currentColor;
						}
					}
				}
			}
		`
	}

	protected override willUpdate(changed: PropertyValues<this>) {
		if (changed.has('stylesheet')) {
			this.css = this.stylesheet.css
		}
	}

	private input(text: string) {
		this.css = text
		clearTimeout(this.previewTimer)
		this.previewTimer = setTimeout(() => this.stylesheet.preview(text), 150)
		clearTimeout(this.saveTimer)
		this.saveTimer = setTimeout(() => void this.save(), 1000)
	}

	private async save() {
		clearTimeout(this.saveTimer)
		if (this.css !== this.stylesheet.css) {
			await this.stylesheet.save(this.css)
		}
	}

	/** Leaving the field shows the text as kept, which drops any `@import`. */
	private async commit() {
		await this.save()
		this.css = this.stylesheet.css
	}

	override disconnectedCallback() {
		super.disconnectedCallback()
		if (this.css !== this.stylesheet.css) {
			void this.save()
		}
	}

	/** GitHub refuses an address much past 8 KB: a longer stylesheet travels by the clipboard instead. */
	private static readonly shareLimit = 8000

	/** A new discussion in the Custom CSS category, its body asking what the stylesheet does, and for a picture of it. */
	private static discussionOf(css: string) {
		const body = `<!-- What does it do? Add a screenshot if it shows something. -->\n\n\`\`\`css\n${css.trim()}\n\`\`\`\n\nMitra ${mitra.version}\n`
		return `https://github.com/a11delavar/mitra/discussions/new?${new URLSearchParams({ category: 'custom-css', body })}`
	}

	private get shareTemplate() {
		const full = CustomCssEditor.discussionOf(this.css)
		const fits = full.length <= CustomCssEditor.shareLimit
		return html`
			<a href=${fits ? full : CustomCssEditor.discussionOf('/* Mitra copied your stylesheet: paste it here. */')} target="_blank" rel="noreferrer"
				@click=${() => fits ? undefined : navigator.clipboard.writeText(this.css).catch(() => undefined)}
			>${t('Share on GitHub')}</a>
		`
	}

	protected override get template() {
		return html`
			<textarea dir="ltr" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label=${this.label}
				placeholder=${':root {\n\t--color-accent: teal;\n}'}
				.value=${live(this.css)}
				@input=${(e: InputEvent) => this.input((e.target as HTMLTextAreaElement).value)}
				@change=${() => void this.commit()}
			></textarea>
			<p class="status">
				${!this.css.trim() ? html.nothing : html`${this.shareTemplate} · `}
				${CustomCss.suspended ? t('Custom CSS is off for this load.') : t('If a rule hides the way back, add ?css=off to the address.')}
				<a href=${docsPage('custom-css')} target="_blank" rel="noreferrer">${t('How to restyle Mitra')}</a>
			</p>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-custom-css-editor': CustomCssEditor
	}
}
