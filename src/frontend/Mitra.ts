import { component, css } from '@a11d/lit'
import { Application, application } from '@a11d/lit-application'

@application()
@component('mitra-application')
export class Mitra extends Application {
	static override get styles() {
		return css`
			${super.styles}

			:root {
				--bg: #191919;
				--border-color: #222222;
				--text-muted: #888;
				--text-light: #e3e3e3;
				--accent: AccentColor;
				--border: 1px solid var(--border-color);
			}
		`
	}
}