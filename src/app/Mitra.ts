import { component, css, eventListener } from '@a11d/lit'
import { Application, application, DialogCancelledError } from '@a11d/lit-application'
import { Localizer } from '@3mo/localization'
import { themeStyles, focusRingStyles, kbdStyles, Choices, Choice, windowDragStyles, Markdown } from '#design'
import { Calendars } from '#features/sources/client/Calendars.js'
import { Weeks } from '#features/calendar/client/Weeks.js'
import { Months } from '#features/calendar/client/Months.js'
import { Days } from '#features/calendar/client/Days.js'
import { Timeline } from '#features/calendar/client/Timeline.js'
import { Table } from '#features/calendar/client/Table.js'
import { TableColumnMenu } from '#features/calendar/client/TableColumnMenu.js'
import { TableSelection } from '#features/calendar/client/TableSelection.js'
import { ParticipantAvatar } from '#features/participants/client/ParticipantAvatar.js'
import { ParticipantFaces } from '#features/participants/client/ParticipantFaces.js'
import { EntryLink } from '#features/relations/client/EntryLink.js'
import { MapLink } from '#features/locations/client/MapLink.js'
import { Day } from '#features/calendar/client/Day.js'
import { EntrySegmentComponent } from '#features/entries/client/EventSegment.js'
import { AvailabilitySegment } from '#features/availability/client/AvailabilitySegment.js'
import { EntryConnections } from '#features/relations/client/EntryConnections.js'
import { PageCalendar } from '#features/calendar/client/PageCalendar.js'
import { CommandPalette } from '#features/commands/client/CommandPalette.js'
import { Planning } from '#features/planning/client/Planning.js'
import { EntryDetailsComponent } from '#features/entries/client/EventDetails.js'
import { DialogAbout } from '#features/about/client/DialogAbout.js'
import { ReleaseNotesComponent } from '#features/about/client/ReleaseNotesComponent.js'
import { DialogWelcome } from '#features/onboarding/client/DialogWelcome.js'
import { DialogSourceMigration } from '#features/migration/client/DialogSourceMigration.js'
import { DialogIcsImport } from '#features/migration/client/DialogIcsImport.js'
import { DialogKeyboardShortcuts } from '#features/commands/client/DialogKeyboardShortcuts.js'
import { DialogSettings } from '#features/settings/client/DialogSettings.js'
import { SettingRow } from '#features/settings/client/SettingRow.js'
import { NotificationDevices } from '#features/reminders/client/NotificationDevices.js'
import { DialogNewAccessToken } from '#features/agents/client/DialogNewAccessToken.js'
import { DialogAccessToken } from '#features/agents/client/DialogAccessToken.js'
import { offerToolsToBrowserAgents } from '#features/agents/client/webMcp.js'
import { TaskStatusComponent } from '#features/entries/client/TaskStatus.js'
import { SourceIcon } from '#features/sources/client/SourceIcon.js'
import { RepeatField } from '#features/recurrence/client/RepeatField.js'
import { LocationField } from '#features/locations/client/LocationField.js'
import { RemindersField } from '#features/reminders/client/RemindersField.js'
import { ParticipantsField } from '#features/participants/client/ParticipantsField.js'
import { AttachmentsField } from '#features/entries/client/AttachmentsField.js'
import { RelationsField } from '#features/relations/client/RelationsField.js'
import { TimeZoneHeader } from '#features/time/client/TimeZoneHeader.js'
import '#features/time/client/TimeZonePicker.js'
import { TimeZones } from '#features/time/client/TimeZones.js'
import { syncPushSubscription } from '#features/reminders/client/push.js'
import { DialogEntryScope } from '#features/entries/client/DialogEntryScope.js'
import { DialogDeleteEntries } from '#features/entries/client/DialogDeleteEntries.js'
import { DialogDuplicateDays } from '#features/entries/client/DialogDuplicateDays.js'
import { DialogCompleteParent } from '#features/relations/client/DialogCompleteParent.js'
import { DialogCloseSubtasks } from '#features/relations/client/DialogCloseSubtasks.js'
import { DialogRelationFailed } from '#features/relations/client/DialogRelationFailed.js'
import { EntryDetailsWhen } from '#features/entries/client/EntryDetailsWhen.js'
import { EntryDetailsSharing } from '#features/entries/client/EntryDetailsSharing.js'
import { EntryStore } from '#features/entries/client/EntryStore.js'
import { ScrollDeviceController } from '#features/calendar/client/ScrollDeviceController.js'
import { hierarchy } from '#features/relations/client/Hierarchy.js'
import { DialogIntegration } from '#integrations/client/DialogIntegration.js'
import { IcsSubscription } from '#integrations/ics/IcsSubscription.js'
import '#integrations/demo/client/language.js'
import { session } from '#infrastructure/http/PageSession.js'
import { LocalePreview } from '#infrastructure/i18n/LocalePreview.js'
import { LocaleSetting } from '#infrastructure/i18n/LocaleSetting.js'
import { Sidebar } from './Sidebar.js'
import { consumeSubscribeParameter, observeFileDrops, observeLaunches } from './launch.js'
import { syncThemeColor } from './pwa.js'

EntryStore.resolveScope = (entry, intent) => hierarchy.resolveRecurrenceScope(entry, intent)
hierarchy.listen()

@application()
@component('mitra-application')
export class Mitra extends Application {
	protected readonly scrollDevice = new ScrollDeviceController(this)

	/** By its tag: the framework's lookup walks every element, and every command reads it on every render. */
	static override get instance() {
		return document.querySelector('mitra-application') as Mitra
	}

	get calendar() {
		return this.querySelector('mitra-page-calendar')!
	}

	/** Dismissing a dialog rejects its `confirm()` to end what opened it; one nothing awaits ends here, as no failure. */
	@eventListener({ target: window, type: 'unhandledrejection' })
	protected absorbDismissal(event: PromiseRejectionEvent) {
		if (event.reason instanceof DialogCancelledError) {
			event.preventDefault()
		}
	}

	protected override async initialized() {
		Mitra.trackFocusModality()
		const pendingIntegrationId = Mitra.consumePendingIntegrationParameter()
		const subscribeUrl = consumeSubscribeParameter()
		await Promise.all([Calendars.fetch(), session.fetchUser(), session.fetchInstance()])
		// After the integrations, so a linked language switches the sample calendar too.
		LocaleSetting.followAccount()
		LocaleSetting.rememberLinkedLanguage()
		// Nothing waits for it: until the account has a home, home is this device's zone anyway.
		void TimeZones.settle().catch(() => void 0)
		void offerToolsToBrowserAgents().catch(() => void 0)
		document.title = this.documentTitle
		// The framework writes the title only when the page heading changes, so a language switch would keep the old name.
		Localizer.locales.change.subscribe(() => document.title = this.documentTitle)
		syncPushSubscription()
		syncThemeColor()
		if (session.user && !session.user?.lastSeenVersion) {
			DialogAbout.markSeen()
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
		} else if (!Calendars.integrations.length) {
			if (await new DialogWelcome().confirm()) {
				await new DialogIntegration({}).confirm()
				document.querySelector('mitra-sidebar')?.requestUpdate()
			}
		}
	}

	private static async subscribe(url: string) {
		const normalized = IcsSubscription.normalizeUrl(url)
		if (!normalized) {
			return
		}
		await new DialogIntegration({ prefill: new IcsSubscription({ uri: normalized }) }).confirm()
		document.querySelector('mitra-sidebar')?.requestUpdate()
	}

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

	protected override get documentTitle() {
		return [this.pageHeading, session.instance.displayName].filter(Boolean).join(' | ')
	}

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

	private static isTextEntry(target: EventTarget | null | undefined) {
		return target instanceof HTMLTextAreaElement
			|| (target instanceof HTMLElement && target.isContentEditable)
			|| (target instanceof HTMLInputElement
				&& !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image'].includes(target.type))
	}

	/** The integration an OAuth redirect returns to, taken out of the address. */
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
				/* A page pinch begun outside a grid can't be undone inside one (the grids take pinch for density), and iOS ignores the viewport's maximum-scale for pinch. */
				touch-action: pan-x pan-y;
			}

			${themeStyles}

			:root {
				user-select: none;
				-webkit-user-select: none;
				-webkit-touch-callout: none;
				-webkit-tap-highlight-color: transparent;
			}

			input, textarea, [contenteditable] {
				user-select: text;
				-webkit-user-select: text;
			}

			${focusRingStyles}
			${kbdStyles}
			${windowDragStyles}

			${ScrollDeviceController.styles}

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
			${AvailabilitySegment.styles}
			${EntryConnections.styles}
			${EntryDetailsComponent.styles}
			${EntryDetailsWhen.styles}
			${EntryDetailsSharing.styles}
			${DialogAbout.styles}
			${ReleaseNotesComponent.styles}
			${DialogIntegration.styles}
			${DialogWelcome.styles}
			${DialogSourceMigration.styles}
			${DialogIcsImport.styles}
			${DialogKeyboardShortcuts.styles}
			${DialogSettings.styles}
			${SettingRow.styles}
			${NotificationDevices.styles}
			${DialogNewAccessToken.styles}
			${DialogAccessToken.styles}
			${LocalePreview.styles}
			${DialogEntryScope.styles}
			${DialogDeleteEntries.styles}
			${DialogDuplicateDays.styles}
			${DialogCompleteParent.styles}
			${DialogCloseSubtasks.styles}
			${DialogRelationFailed.styles}
			${TaskStatusComponent.styles}
			${SourceIcon.styles}
			${RepeatField.styles}
			${LocationField.styles}
			${RemindersField.styles}
			${ParticipantsField.styles}
			${AttachmentsField.styles}
			${RelationsField.styles}
			${TimeZoneHeader.styles}
		`
	}
}
