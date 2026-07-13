import { component, css } from '@a11d/lit'
import { Application, application } from '@a11d/lit-application'
import { fetchIntegrations, fetchUser } from './Api.js'
import { Weeks } from './Weeks.js'
import { Months } from './Months.js'
import { Days } from './Days.js'
import { Day } from './Day.js'
import { EntrySegmentComponent } from './EventSegment.js'
import { PageCalendar } from './PageCalendar.js'
import { CommandPalette } from './CommandPalette.js'
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
import { LocationField } from './components/LocationField.js'
import { RemindersField } from './components/RemindersField.js'
import { RelationsField } from './components/RelationsField.js'
import { TimeZoneHeader, DialogTimeZoneRename } from './components/TimeZoneHeader.js'
import { TimeZonePicker } from './components/TimeZonePicker.js'
import { syncPushSubscription } from './push.js'
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
		// Consumed BEFORE the router's first render: the routed page adopts the URL's query into its
		// parameters and re-pushes it on navigation, which would resurrect an already-stripped param.
		const pendingIntegrationId = Mitra.consumePendingIntegrationParameter()
		await Promise.all([fetchIntegrations(), fetchUser()])
		// Where notification permission was granted before, quietly refresh the push subscription so a
		// push-service-side endpoint rotation never silently mutes reminders. Never prompts.
		syncPushSubscription()
		await super.initialized()
		if (pendingIntegrationId) {
			// Fresh from the OAuth consent flow — tick every discovered source by default (fresh-add UX).
			await new DialogIntegration({ id: pendingIntegrationId, preselectSources: true }).confirm()
			// The sidebar renders off the module-level integrations cache — nudge it like its own dialogs do.
			document.querySelector('mitra-sidebar')?.requestUpdate()
		}
	}

	/** Returning from Google's consent screen lands on `/?integration=<id>` (see the backend's
	 * google/callback) — that integration's source picker is opened so the user finishes the setup.
	 * The parameter is stripped immediately so a reload doesn't reopen the dialog. */
	private static consumePendingIntegrationParameter(): string | null {
		const parameters = new URLSearchParams(location.search)
		const id = parameters.get('integration')
		if (id) {
			parameters.delete('integration')
			history.replaceState(null, '', `${location.pathname}${parameters.size ? `?${parameters}` : ''}`)
		}
		return id
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
				--color-accent: light-dark(black, white);
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
			${CommandPalette.styles}
			${Sidebar.styles}
			${Weeks.styles}
			${Months.styles}
			${Days.styles}
			${Day.styles}
			${EntrySegmentComponent.styles}
			${EntryDetailsComponent.styles}
			${EntryDetailsWhen.styles}
			${DialogIntegration.styles}
			${DialogRecurrenceScope.styles}
			${TaskStatusComponent.styles}
			${RepeatField.styles}
			${LocationField.styles}
			${RemindersField.styles}
			${RelationsField.styles}
			${TimeZoneHeader.styles}
			${DialogTimeZoneRename.styles}
			${TimeZonePicker.styles}
		`
	}
}
