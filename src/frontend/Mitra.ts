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
				--color-background: light-dark(#ffffff, #121314);
				--color-text: light-dark(#121314, #e3e3e3);
				--color-text-muted: light-dark(#666666, #888888);
				--color-accent: #e05252;
				--color-accent-text: white;
				--color-border: color-mix(in srgb, var(--color-text) 7.5%, var(--color-background));
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