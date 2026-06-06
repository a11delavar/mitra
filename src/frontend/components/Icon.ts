import { Component, component, property, css, html } from '@a11d/lit'
import { icons, createElement } from 'lucide'

@component('mitra-icon')
export class Icon extends Component {
	@property() icon!: string
	/** Fill the glyph with `currentColor` (e.g. a solid "active" star) instead of the default outline. */
	@property({ type: Boolean }) fill = false

	static override get styles() {
		return css`
			:host {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 1em;
				height: 1em;
				flex-shrink: 0;
			}

			svg {
				width: 100%;
				height: 100%;
			}
		`
	}

	private toPascalCase(str: string) {
		return str.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')
	}

	protected override get template() {
		if (!this.icon) {
			return html.nothing
		}

		const name = this.toPascalCase(this.icon) as keyof typeof icons
		const data = icons[name]

		if (!data) {
			console.warn(`Icon "${this.icon}" not found in lucide icons.`)
			return html.nothing
		}

		// Create the SVG DOM node directly using lucide's utility
		const svgElement = createElement(data)

		// Ensure it inherits the color and stroke width correctly
		svgElement.setAttribute('fill', this.fill ? 'currentColor' : 'none')
		svgElement.setAttribute('stroke', 'currentColor')
		svgElement.setAttribute('stroke-width', '2')
		svgElement.setAttribute('stroke-linecap', 'round')
		svgElement.setAttribute('stroke-linejoin', 'round')

		return html`${svgElement}`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-icon': Icon
	}
}
