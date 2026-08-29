import { component, css } from '@a11d/lit'
import { Application, application } from '@a11d/lit-application'
import { fetchIntegrations, fetchMeta, fetchUser, getIntegrations, getMeta, getUser } from '../infrastructure/http/Api.js'
import { Weeks } from '../features/calendar/client/Weeks.js'
import { Months } from '../features/calendar/client/Months.js'
import { Days } from '../features/calendar/client/Days.js'
import { Timeline } from '../features/calendar/client/Timeline.js'
import { Day } from '../features/calendar/client/Day.js'
import { EntrySegmentComponent } from '../features/entries/client/EventSegment.js'
import { EntryConnections } from '../features/relations/client/EntryConnections.js'
import { PageCalendar } from '../features/calendar/client/PageCalendar.js'
import { CommandPalette } from '../features/commands/client/CommandPalette.js'
import { Sidebar } from './Sidebar.js'
import { Unscheduled } from '../features/planning/client/Unscheduled.js'
import { EntryDetailsComponent } from '../features/entries/client/EventDetails.js'
import { DialogAbout, markChangesSeen } from '../features/about/client/DialogAbout.js'
import { DialogIntegration } from '../integrations/client/DialogIntegration.js'
import { DialogWelcome } from '../features/onboarding/client/DialogWelcome.js'
import { DialogSourceMigration } from '../features/migration/client/DialogSourceMigration.js'
import { DialogKeyboardShortcuts } from '../features/commands/client/DialogKeyboardShortcuts.js'
import { DialogSettings } from '../features/settings/client/DialogSettings.js'
import { SettingRow } from '../features/settings/client/SettingRow.js'
import { NotificationDevices } from '../features/reminders/client/NotificationDevices.js'
import { contrastColor } from '../design/contrastColor.js'
import { IconButton } from '../design/IconButton.js'
import { buttonStyles } from '../design/button.css.js'
import { switchStyles } from '../design/switch.css.js'
import { selectStyles } from '../design/select.css.js'
import { inputStyles } from '../design/input.css.js'
import { fieldStyles } from '../design/field.css.js'
import { focusRingStyles } from '../design/focusRing.css.js'
import { kbdStyles } from '../design/kbd.css.js'
import { menuStyles } from '../design/menu.css.js'
import { sheetStyles, initializeSheetGestures } from '../design/sheet.js'
import { Choices, Choice } from '../design/Choices.js'
import { windowDragStyles } from '../design/windowDrag.css.js'
import { TaskStatusComponent } from '../features/entries/client/TaskStatus.js'
import { SourceIcon } from '../features/sources/client/SourceIcon.js'
import { RepeatField } from '../features/recurrence/client/RepeatField.js'
import { LocationField } from '../features/locations/client/LocationField.js'
import { RemindersField } from '../features/reminders/client/RemindersField.js'
import { ParticipantsField } from '../features/participants/client/ParticipantsField.js'
import { RelationsField } from '../features/relations/client/RelationsField.js'
import { TimeZoneHeader, DialogTimeZoneRename } from '../features/time/client/TimeZoneHeader.js'
import { TimeZonePicker } from '../features/time/client/TimeZonePicker.js'
import { syncPushSubscription } from '../features/reminders/client/push.js'
import { syncThemeColor } from './pwa.js'
import { DialogEntryScope } from '../features/entries/client/DialogEntryScope.js'
import { DialogCompleteParent } from '../features/relations/client/DialogCompleteParent.js'
import { DialogCloseSubtasks } from '../features/relations/client/DialogCloseSubtasks.js'
import { DialogRelationFailed } from '../features/relations/client/DialogRelationFailed.js'
import { Markdown } from '../design/Markdown.js'
import { EntryDetailsWhen } from '../features/entries/client/EntryDetailsWhen.js'
import { EntryDetailsSharing } from '../features/entries/client/EntryDetailsSharing.js'
import { EntryStore } from '../features/entries/client/EntryStore.js'
import { ScrollDeviceController } from '../features/calendar/client/ScrollDeviceController.js'
import { installHierarchyPrompts, resolveRecurrenceScope } from '../features/relations/client/Hierarchy.js'

EntryStore.resolveScope = resolveRecurrenceScope
installHierarchyPrompts()

@application()
@component('mitra-application')
export class Mitra extends Application {
	protected readonly scrollDevice = new ScrollDeviceController(this)

	/** Document-resolved application singleton. */
	static override get instance() {
		return Application.instance as Mitra
	}

	/** Calendar page light DOM query resolver. */
	get calendar() {
		return this.querySelector('mitra-page-calendar')!
	}

	protected override async initialized() {
		initializeSheetGestures()
		Mitra.trackFocusModality()
		const pendingIntegrationId = Mitra.consumePendingIntegrationParameter()
		await Promise.all([fetchIntegrations(), fetchUser(), fetchMeta()])
		document.title = this.documentTitle
		syncPushSubscription()
		syncThemeColor()
		if (getUser() && !getUser()?.lastSeenVersion) {
			markChangesSeen()
		}
		await super.initialized()
		if (pendingIntegrationId) {
			await new DialogIntegration({ id: pendingIntegrationId, preselectSources: true }).confirm()
			document.querySelector('mitra-sidebar')?.requestUpdate()
		} else if (!getIntegrations().length) {
			if (await new DialogWelcome().confirm()) {
				await new DialogIntegration({}).confirm()
				document.querySelector('mitra-sidebar')?.requestUpdate()
			}
		}
	}

	/** Window title derived from page heading and instance name. */
	protected override get documentTitle() {
		return [this.pageHeading, getMeta()?.name || 'Mitra'].filter(Boolean).join(' | ')
	}

	/** Track global focus modality (keyboard vs pointer) for focus rings. */
	private static trackFocusModality() {
		const set = (modality: 'keyboard' | 'pointer') => document.documentElement.dataset.focusModality = modality
		set('pointer')
		addEventListener('keydown', event => {
			if (event.key === 'Tab' || !Mitra.isTextEntry(event.composedPath()[0] ?? event.target)) {
				set('keyboard')
			}
		}, { capture: true, passive: true })
		addEventListener('pointerdown', () => set('pointer'), { capture: true, passive: true })
	}

	/** Detect whether target is a text input field. */
	private static isTextEntry(target: EventTarget | null | undefined) {
		return target instanceof HTMLTextAreaElement
			|| (target instanceof HTMLElement && target.isContentEditable)
			|| (target instanceof HTMLInputElement
				&& !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image'].includes(target.type))
	}

	/** Extract and strip OAuth redirect integration query parameter. */
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

			/* Fill initial containing block and prevent root scroll chaining. */
			html, body, [application] {
				height: 100%;
				min-height: 0;
			}

			html {
				overflow: hidden;
				overscroll-behavior: none;
			}

			:root {
				color-scheme: light dark;
				user-select: none;
				-webkit-tap-highlight-color: transparent;
				--color-background-seed: color-mix(in srgb, light-dark(#f1f3f4, #121314), var(--color-accent) 2.5%);
				--color-background: var(--color-background-seed);
				--color-surface: color-mix(in srgb, light-dark(#ffffff, #191a1b), var(--color-accent) 5%);
				--color-text: color-mix(in srgb, light-dark(black, white), var(--color-accent) 2.5%);
				--color-text-muted: color-mix(in srgb, var(--color-text), var(--color-background) 45%);
				--color-error: light-dark(#d1453b, #e5675e);
				--color-accent: light-dark(black, white);
				--color-accent-text: ${contrastColor('var(--color-accent)')};
				--color-border: var(--color-surface);
				--border: 1px solid var(--color-border);
				--border-radius: 4px;

				&[data-theme=light] {
					color-scheme: light;
				}

				&[data-theme=dark] {
					color-scheme: dark;
				}
			}

			${buttonStyles}
			${switchStyles}
			${selectStyles}
			${inputStyles}
			${fieldStyles}
			${focusRingStyles}
			${menuStyles}
			${kbdStyles}
			${sheetStyles}
			${windowDragStyles}

			${ScrollDeviceController.styles}

			${IconButton.styles}
			${Choices.styles}
			${Choice.styles}
			${Markdown.styles}
			${PageCalendar.styles}
			${CommandPalette.styles}
			${Sidebar.styles}
			${Unscheduled.styles}
			${Weeks.styles}
			${Months.styles}
			${Days.styles}
			${Timeline.styles}
			${Day.styles}
			${EntrySegmentComponent.styles}
			${EntryConnections.styles}
			${EntryDetailsComponent.styles}
			${EntryDetailsWhen.styles}
			${EntryDetailsSharing.styles}
			${DialogAbout.styles}
			${DialogIntegration.styles}
			${DialogWelcome.styles}
			${DialogSourceMigration.styles}
			${DialogKeyboardShortcuts.styles}
			${DialogSettings.styles}
			${SettingRow.styles}
			${NotificationDevices.styles}
			${DialogEntryScope.styles}
			${DialogCompleteParent.styles}
			${DialogCloseSubtasks.styles}
			${DialogRelationFailed.styles}
			${TaskStatusComponent.styles}
			${SourceIcon.styles}
			${RepeatField.styles}
			${LocationField.styles}
			${RemindersField.styles}
			${ParticipantsField.styles}
			${RelationsField.styles}
			${TimeZoneHeader.styles}
			${DialogTimeZoneRename.styles}
			${TimeZonePicker.styles}
		`
	}
}
