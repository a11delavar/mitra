import { component, css } from '@a11d/lit'
import { Application, application } from '@a11d/lit-application'
import { Month } from './Month.js'
import { Days } from './Days.js'
import { Day } from './Day.js'
import { EventSegmentC } from './EventSegment.js'
import { PageCalendar } from './PageCalendar.js'
import { Sidebar } from './Sidebar.js'
import { EventDetails } from './EventDetails.js'
import { colorContrast } from './colorContrast.js'
import { buttonStyles } from './button.css.js'

@application()
@component('mitra-application')
export class Mitra extends Application {
	static override get styles() {
		return css`
			${super.styles}

			:root {
				color-scheme: light dark;
				user-select: none;
				--color-background: color-mix(in srgb, light-dark(#f1f3f4, #121314), var(--color-accent) 2.5%);
				--color-surface: color-mix(in srgb, light-dark(#ffffff, #191a1b), var(--color-accent) 5%);
				--color-text: color-mix(in srgb, light-dark(black, white), var(--color-accent) 2.5%);
				--color-text-muted: color-mix(in srgb, var(--color-text), var(--color-background) 45%);
				--color-accent: #eb5a5a;
				--color-accent-text: ${colorContrast('var(--color-accent)')};
				--color-border: var(--color-background);
				--border: 1px solid var(--color-border);
				--border-radius: 4px;
			}

			${buttonStyles}

			${PageCalendar.styles}
			${Sidebar.styles}
			${Month.styles}
			${Days.styles}
			${Day.styles}
			${EventSegmentC.styles}
			${EventDetails.styles}
		`
	}
}