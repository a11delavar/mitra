import { component, css } from '@a11d/lit'
import { Application, application } from '@a11d/lit-application'
import { fetchIntegrations, fetchUser } from './Api.js'
import { Month } from './Month.js'
import { Days } from './Days.js'
import { Day } from './Day.js'
import { EntrySegmentComponent } from './EventSegment.js'
import { PageCalendar } from './PageCalendar.js'
import { Sidebar } from './Sidebar.js'
import { EntryDetailsComponent } from './EventDetails.js'
import { DialogIntegration } from './DialogIntegration.js'
import { colorContrast } from './components/colorContrast.js'
import { IconButton } from './components/IconButton.js'
import { buttonStyles } from './components/button.css.js'
import { switchStyles } from './components/switch.css.js'
import { selectStyles } from './components/select.css.js'
import { inputStyles } from './components/input.css.js'
import { menuStyles } from './components/menu.css.js'
import { TaskStatusComponent } from './components/TaskStatus.js'
import { RepeatField } from './components/RepeatField.js'
import { DialogRecurrenceScope } from './components/DialogRecurrenceScope.js'
import { Markdown } from './Markdown.js'
import { EntryDetailsWhen } from './EntryDetailsWhen.js'
import { EntryStore } from './EntryStore.js'

// How far a series edit/delete reaches is the user's call — the store asks through this dialog.
EntryStore.resolveScope = (entry, intent) => new DialogRecurrenceScope({ entry, intent }).confirm()

@application()
@component('mitra-application')
export class Mitra extends Application {
	protected override async initialized() {
		await Promise.all([fetchIntegrations(), fetchUser()])
		await super.initialized()
	}

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
			${switchStyles}
			${selectStyles}
			${inputStyles}
			${menuStyles}

			${IconButton.styles}
			${Markdown.styles}
			${PageCalendar.styles}
			${Sidebar.styles}
			${Month.styles}
			${Days.styles}
			${Day.styles}
			${EntrySegmentComponent.styles}
			${EntryDetailsComponent.styles}
			${EntryDetailsWhen.styles}
			${DialogIntegration.styles}
			${DialogRecurrenceScope.styles}
			${TaskStatusComponent.styles}
			${RepeatField.styles}
		`
	}
}
