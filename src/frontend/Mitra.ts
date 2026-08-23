import { component, css } from '@a11d/lit'
import { Application, application } from '@a11d/lit-application'
import { fetchIntegrations, fetchMeta, fetchUser, getIntegrations, getMeta, getUser } from './Api.js'
import { Weeks } from './Weeks.js'
import { Months } from './Months.js'
import { Days } from './Days.js'
import { Day } from './Day.js'
import { EntrySegmentComponent } from './EventSegment.js'
import { EntryConnections } from './EntryConnections.js'
import { PageCalendar } from './PageCalendar.js'
import { CommandPalette } from './CommandPalette.js'
import { Sidebar } from './Sidebar.js'
import { Unscheduled } from './Unscheduled.js'
import { EntryDetailsComponent } from './EventDetails.js'
import { DialogAbout, markChangesSeen } from './DialogAbout.js'
import { DialogIntegration } from './DialogIntegration.js'
import { DialogWelcome } from './DialogWelcome.js'
import { DialogKeyboardShortcuts } from './DialogKeyboardShortcuts.js'
import { contrastColor } from './components/contrastColor.js'
import { IconButton } from './components/IconButton.js'
import { buttonStyles } from './components/button.css.js'
import { switchStyles } from './components/switch.css.js'
import { selectStyles } from './components/select.css.js'
import { inputStyles } from './components/input.css.js'
import { fieldStyles } from './components/field.css.js'
import { focusRingStyles } from './components/focusRing.css.js'
import { kbdStyles } from './components/kbd.css.js'
import { menuStyles } from './components/menu.css.js'
import { sheetStyles, initializeSheetGestures } from './components/sheet.js'
import { Choices, Choice } from './components/Choices.js'
import { windowDragStyles } from './components/windowDrag.css.js'
import { TaskStatusComponent } from './components/TaskStatus.js'
import { SourceIcon } from './components/SourceIcon.js'
import { RepeatField } from './components/RepeatField.js'
import { LocationField } from './components/LocationField.js'
import { RemindersField } from './components/RemindersField.js'
import { ParticipantsField } from './components/ParticipantsField.js'
import { RelationsField } from './components/RelationsField.js'
import { TimeZoneHeader, DialogTimeZoneRename } from './components/TimeZoneHeader.js'
import { TimeZonePicker } from './components/TimeZonePicker.js'
import { syncPushSubscription } from './push.js'
import { syncThemeColor } from './pwa.js'
import { DialogEntryScope } from './components/DialogEntryScope.js'
import { DialogCompleteParent } from './components/DialogCompleteParent.js'
import { DialogCloseSubtasks } from './components/DialogCloseSubtasks.js'
import { Markdown } from './Markdown.js'
import { EntryDetailsWhen } from './EntryDetailsWhen.js'
import { EntryDetailsSharing } from './EntryDetailsSharing.js'
import { EntryStore } from './EntryStore.js'
import { ScrollDeviceController } from './ScrollDeviceController.js'
import { installHierarchyPrompts, resolveRecurrenceScope } from './Hierarchy.js'

EntryStore.resolveScope = resolveRecurrenceScope
installHierarchyPrompts()

@application()
@component('mitra-application')
export class Mitra extends Application {
	protected readonly scrollDevice = new ScrollDeviceController(this)

	/** The framework's document-resolved application (see queryInstanceElement), narrowed to Mitra —
	 * the root every context-less collaborator (the command classes) reaches app state through. The
	 * `@application()` decorator appends the instance at module evaluation, so any code that can ask
	 * for it is running in a document that already has it. */
	static override get instance() {
		return Application.instance as Mitra
	}

	/** The calendar page — the app's one route and the surface commands drive. Pages render into the
	 * application's light DOM, so a tag query resolves it; only the very first render (before the
	 * router mounts a page) has none, and nothing reachable by then asks. */
	get calendar() {
		return this.querySelector('mitra-page-calendar')!
	}

	protected override async initialized() {
		// The sheet popovers' swipe-to-dismiss/tap-to-dismiss/slide-in intents, delegated once for
		// every current and future sheet in the app (see components/sheet.ts).
		initializeSheetGestures()
		Mitra.trackFocusModality()
		// Consumed BEFORE the router's first render: the routed page adopts the URL's query into its
		// parameters and re-pushes it on navigation, which would resurrect an already-stripped param.
		const pendingIntegrationId = Mitra.consumePendingIntegrationParameter()
		await Promise.all([fetchIntegrations(), fetchUser(), fetchMeta()])
		// The framework only re-derives the tab title when a page heading changes — stamp the initial
		// one now that the instance's name (see documentTitle) has arrived.
		document.title = this.documentTitle
		// Where notification permission was granted before, quietly refresh the push subscription so a
		// push-service-side endpoint rotation never silently mutes reminders. Never prompts.
		syncPushSubscription()
		// Match the WCO title-bar strip (behind the window buttons) to the header, in both themes.
		syncThemeColor()
		// A user with no recorded notes-version yet (fresh install / first sign-in): record the running
		// version silently, so the sidebar's news dot only ever means "the instance moved since you last
		// looked", never "welcome". Nothing opens by itself — news waits until asked.
		if (getUser() && !getUser()?.lastSeenVersion) {
			markChangesSeen()
		}
		await super.initialized()
		if (pendingIntegrationId) {
			// Fresh from the OAuth consent flow — tick every discovered source by default (fresh-add UX).
			await new DialogIntegration({ id: pendingIntegrationId, preselectSources: true }).confirm()
			// The sidebar renders off the module-level integrations cache — nudge it like its own dialogs do.
			document.querySelector('mitra-sidebar')?.requestUpdate()
		} else if (!getIntegrations().length) {
			// Nothing connected yet — the calendar behind is an empty grid, so greet and lead the way in.
			// Dismissing is respected for this visit only: an empty boot asks again, a connected one never.
			if (await new DialogWelcome().confirm()) {
				await new DialogIntegration({}).confirm()
				document.querySelector('mitra-sidebar')?.requestUpdate()
			}
		}
	}

	/** The tab title, rebuilt by the base Application on every page-heading change. Overridden so a
	 * renamed instance (MITRA_NAME) carries its name here too — the base formula would fall back to
	 * the manifest's short name, which is baked at build time and intentionally stays Mitra. */
	protected override get documentTitle() {
		return [this.pageHeading, getMeta()?.name || 'Mitra'].filter(Boolean).join(' | ')
	}

	/** Which input device the user is currently driving the app with — the app's one genuinely global
	 * piece of style state, because the focus ring shows only for a keyboard and every ringed surface
	 * (including ones inside a shadow root) has to see it; `focusRing.css.ts` explains why it travels as
	 * a custom property. Listeners are CAPTURING and passive so no handler that stops propagation can
	 * hide the modality from us, and so this never costs a gesture anything. */
	private static trackFocusModality() {
		const set = (modality: 'keyboard' | 'pointer') => document.documentElement.dataset.focusModality = modality
		set('pointer')
		// TYPING IS NOT NAVIGATING. A keystroke means "I'm driving by keyboard, show me where focus is"
		// everywhere except inside something you type into: there the caret already says where you are,
		// and ringing the field you clicked into the moment you type in it is pure noise. Tab is the
		// exception even there — it's the key that MOVES focus, so the field it lands on must ring.
		addEventListener('keydown', event => {
			if (event.key === 'Tab' || !Mitra.isTextEntry(event.composedPath()[0] ?? event.target)) {
				set('keyboard')
			}
		}, { capture: true, passive: true })
		addEventListener('pointerdown', () => set('pointer'), { capture: true, passive: true })
	}

	/** Whether a keystroke landed in something the user types INTO, so it is text rather than a command.
	 * Read off the composed path, not `document.activeElement`, which reports the HOST for a control
	 * inside a shadow root (the dialogs) and would call every field in one a command surface. */
	private static isTextEntry(target: EventTarget | null | undefined) {
		return target instanceof HTMLTextAreaElement
			|| (target instanceof HTMLElement && target.isContentEditable)
			|| (target instanceof HTMLInputElement
				&& !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image'].includes(target.type))
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

			/* Mitra is a fixed shell — the calendar page is 'position: absolute; inset: 0', i.e. exactly the
			   initial containing block, and every scroller in the app lives INSIDE it. So the document must
			   be exactly the viewport too: 'height: 100%' resolves against that same ICB, and the
			   'min-height' the framework sets above (100dvh) is overridden to nothing.

			   Dropping that min-height is the fix for a real bug, not tidying. 100dvh is the browser's
			   DYNAMIC viewport reading, and wherever it disagrees with the ICB by even a few pixels — which
			   Android's system-bar and virtual-keyboard transitions do — the document ends up that much
			   taller than the viewport. That is a scroll range on the ROOT scroller, invisible (there is
			   nothing down there to see) until a pan that runs past the end of the week grid CHAINS into
			   it: the whole shell then scrolls up, the header slides out of view, the canvas shows through
			   the strip it left at the bottom — and nothing scrolls it back, because no gesture inside the
			   app ever reaches the root scroller (reported from mobile; reproduced with a forced 56px
			   range, which is exactly what one hidden system bar's worth of disagreement looks like).
			   With height: 100% the document can never exceed the ICB, so that range cannot exist at all.

			   The root's own overscroll is then turned off for its own sake: an app shell that cannot
			   scroll has no pull-to-refresh to offer either. */
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
				/* Android paints a translucent slab of the system accent over whatever was tapped — a box the
				   size of the CONTROL, in a colour that is nobody's brand, landing on top of the hover and
				   activated surfaces the app already draws. Declared once here because the property
				   INHERITS: one line reaches every button, menu row, field and segment in the app. */
				-webkit-tap-highlight-color: transparent;
				--color-background-seed: color-mix(in srgb, light-dark(#f1f3f4, #121314), var(--color-accent) 2.5%);
				--color-background: var(--color-background-seed);
				--color-surface: color-mix(in srgb, light-dark(#ffffff, #191a1b), var(--color-accent) 5%);
				--color-text: color-mix(in srgb, light-dark(black, white), var(--color-accent) 2.5%);
				--color-text-muted: color-mix(in srgb, var(--color-text), var(--color-background) 45%);
				/* The app's one semantic status colour, for something it knows is wrong (today: a dependency
				   whose entries break it). The only hue in an otherwise monochrome palette, which is what lets
				   it whisper and still be seen. */
				--color-error: light-dark(#d1453b, #e5675e);
				--color-accent: light-dark(black, white);
				--color-accent-text: ${contrastColor('var(--color-accent)')};
				--color-border: var(--color-surface);
				--border: 1px solid var(--color-border);
				--border-radius: 4px;
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
			${Day.styles}
			${EntrySegmentComponent.styles}
			${EntryConnections.styles}
			${EntryDetailsComponent.styles}
			${EntryDetailsWhen.styles}
			${EntryDetailsSharing.styles}
			${DialogAbout.styles}
			${DialogIntegration.styles}
			${DialogWelcome.styles}
			${DialogKeyboardShortcuts.styles}
			${DialogEntryScope.styles}
			${DialogCompleteParent.styles}
			${DialogCloseSubtasks.styles}
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
