import { component, css } from '@a11d/lit'
import { Application, application } from '@a11d/lit-application'
import { Month } from './Month.js'
import { Days } from './Days.js'
import { Day } from './Day.js'
import { Event } from './Event.js'
import { PageHome } from './PageHome.js'

@application()
@component('mitra-application')
export class Mitra extends Application {
	static override get styles() {
		return css`
			${super.styles}

			:root {
				color-scheme: light dark;
				--color-background: color-mix(in srgb, light-dark(#f1f3f4, #121314), var(--color-accent) 2%);
				--color-surface: color-mix(in srgb, light-dark(#ffffff, #191a1b), var(--color-accent) 4%);
				--color-text: color-mix(in srgb, light-dark(#3c4043, #e3e3e3), var(--color-accent) 2%);
				--color-text-muted: light-dark(#70757a, #9aa0a6);
				--color-accent: #e05252;
				--color-accent-text: black;
				--color-border: var(--color-background);
				--border: 1px solid var(--color-border);
			}

			${PageHome.styles}
			${Month.styles}
			${Days.styles}
			${Day.styles}
			${Event.styles}
		`
	}
}