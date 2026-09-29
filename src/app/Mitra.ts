import { component, css } from '@a11d/lit'
import { Application, application, DialogCancelledError } from '@a11d/lit-application'
import { fetchIntegrations, fetchMeta, fetchUser, getIntegrations, getMeta, getUser } from '../infrastructure/http/Api.js'
import { Weeks } from '../features/calendar/client/Weeks.js'
import { Months } from '../features/calendar/client/Months.js'
import { Days } from '../features/calendar/client/Days.js'
import { Timeline } from '../features/calendar/client/Timeline.js'
import { Table } from '../features/calendar/client/Table.js'
import { TableColumnMenu } from '../features/calendar/client/TableColumnMenu.js'
import { TableSelection } from '../features/calendar/client/TableSelection.js'
import { ParticipantAvatar } from '../features/participants/client/ParticipantAvatar.js'
import { ParticipantFaces } from '../features/participants/client/ParticipantFaces.js'
import { EntryLink } from '../features/relations/client/EntryLink.js'
import { MapLink } from '../features/locations/client/MapLink.js'
import { Day } from '../features/calendar/client/Day.js'
import { EntrySegmentComponent } from '../features/entries/client/EventSegment.js'
import { EntryConnections } from '../features/relations/client/EntryConnections.js'
import { PageCalendar } from '../features/calendar/client/PageCalendar.js'
import { CommandPalette } from '../features/commands/client/CommandPalette.js'
import { Sidebar } from './Sidebar.js'
import { Planning } from '../features/planning/client/Planning.js'
import { EntryDetailsComponent } from '../features/entries/client/EventDetails.js'
import { DialogAbout, markChangesSeen } from '../features/about/client/DialogAbout.js'
import { DialogIntegration } from '../integrations/client/DialogIntegration.js'
import { DialogWelcome } from '../features/onboarding/client/DialogWelcome.js'
import { DialogSourceMigration } from '../features/migration/client/DialogSourceMigration.js'
import { DialogIcsImport } from '../features/migration/client/DialogIcsImport.js'
import { IcsSubscription } from '../integrations/ics/IcsSubscription.js'
import { consumeSubscribeParameter, observeFileDrops, observeLaunches } from './launch.js'
import { DialogKeyboardShortcuts } from '../features/commands/client/DialogKeyboardShortcuts.js'
import { DialogSettings } from '../features/settings/client/DialogSettings.js'
import { SettingRow } from '../features/settings/client/SettingRow.js'
import { NotificationDevices } from '../features/reminders/client/NotificationDevices.js'
import { themeStyles } from '../design/theme.css.js'
import { IconButton } from '../design/IconButton.js'
import { buttonStyles } from '../design/button.css.js'
import { switchStyles } from '../design/switch.css.js'
import { selectStyles } from '../design/select.css.js'
import { inputStyles } from '../design/input.css.js'
import { fieldStyles } from '../design/field.css.js'
import { focusRingStyles } from '../design/focusRing.css.js'
import { kbdStyles } from '../design/kbd.css.js'
import { menuStyles } from '../design/menu.css.js'
import { sheetStyles } from '../design/sheet.js'
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
import { DialogDeleteEntries } from '../features/entries/client/DialogDeleteEntries.js'
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
		Mitra.trackFocusModality()
		const pendingIntegrationId = Mitra.consumePendingIntegrationParameter()
		const subscribeUrl = consumeSubscribeParameter()
		await Promise.all([fetchIntegrations(), fetchUser(), fetchMeta()])
		document.title = this.documentTitle
		syncPushSubscription()
		syncThemeColor()
		if (getUser() && !getUser()?.lastSeenVersion) {
			markChangesSeen()
		}
		await super.initialized()
		// Warm OS launches (focus-existing) and file opens arrive here even while another dialog is up.
		observeLaunches({
			subscribe: url => void Mitra.subscribe(url),
			files: files => void Mitra.addCalendarFiles(files),
		})
		observeFileDrops(files => void Mitra.addCalendarFiles(files))
		if (pendingIntegrationId) {
			await new DialogIntegration({ id: pendingIntegrationId, preselectSources: true }).confirm()
			document.querySelector('mitra-sidebar')?.requestUpdate()
		} else if (subscribeUrl) {
			await Mitra.subscribe(subscribeUrl)
		} else if (!getIntegrations().length) {
			if (await new DialogWelcome().confirm()) {
				await new DialogIntegration({}).confirm()
				document.querySelector('mitra-sidebar')?.requestUpdate()
			}
		}
	}

	/** Opens the connect dialog prefilled with a subscription for a webcal: (or .ics link) launch. */
	private static async subscribe(url: string) {
		const normalized = IcsSubscription.normalizeUrl(url)
		if (!normalized) {
			return
		}
		await new DialogIntegration({ prefill: new IcsSubscription({ uri: normalized }) }).confirm()
			.catch(Mitra.absorbCancellation)
		document.querySelector('mitra-sidebar')?.requestUpdate()
	}

	/** Runs the add-to-calendar flow for opened or dropped .ics files, one at a time. */
	private static async addCalendarFiles(files: ReadonlyArray<File>) {
		for (const file of files) {
			await new DialogIcsImport({ fileName: file.name, ics: await file.text() }).confirm()
				.catch(Mitra.absorbCancellation)
		}
	}

	private static absorbCancellation(error: unknown) {
		if (!(error instanceof DialogCancelledError)) {
			throw error
		}
		return undefined
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

			${themeStyles}

			:root {
				user-select: none;
				-webkit-tap-highlight-color: transparent;
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
			${Planning.styles}
			${Weeks.styles}
			${Months.styles}
			${Days.styles}
			${Timeline.styles}
			${Table.styles}
			${TableColumnMenu.styles}
			${TableSelection.styles}
			${ParticipantAvatar.styles}
			${ParticipantFaces.styles}
			${EntryLink.styles}
			${MapLink.styles}
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
			${DialogIcsImport.styles}
			${DialogKeyboardShortcuts.styles}
			${DialogSettings.styles}
			${SettingRow.styles}
			${NotificationDevices.styles}
			${DialogEntryScope.styles}
			${DialogDeleteEntries.styles}
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
