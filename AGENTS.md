# AI Agent Instructions

## Core Architecture & Frontend Constraints
- **Stack**: TypeScript, Lit, modern CSS. Standard web components only (no React/Vue).
- **Lit Standards**: Decorators (`@component`, `@property`, `@state`). Light DOM encapsulation (`createRenderRoot() { return this }`) for global theming and View Transitions.
- **Component Registration**: Every Light-DOM component's `static styles` MUST be registered in `Mitra.ts`'s aggregated styles array.
- **Lit CSS**: Place styles in `static override get styles() { return css`...` }` (import `css` from 'lit').
- **State Styling**: Attach boolean data attributes (`<div ?data-state>`) and nest selectors (`.child { &[data-state] { ... } }`). Never fight `:host([attr])`.
- **CSS Architecture**:
  - **Nesting**: All rules MUST be nested reflecting DOM hierarchy.
  - **Naming**: Domain-semantic class names (`.header`, `.entries`, `.time`, `.start`, `.end`, `.more`). No structural names (`btn`, `wrapper`, `container`, `layout`). Flat templates without wrapper divs.
  - **Logical Properties**: Always use CSS Logical Properties (`margin-inline-start`, `inset-inline-start`, `border-end-start-radius`, `padding-inline-end`). No `box-shadow` for asymmetrical borders (use pseudo-elements).
  - **Units**: `rem` for layout (padding, margin, font sizes, dimensions). `px` strictly for 1px borders and container query thresholds.
  - **Theming**: Never hardcode fallbacks in `var(--theme-var)` (theme vars are guaranteed globally).
  - **Responsiveness**: CSS Container Queries (`@container`) instead of media queries.
  - **Prefer CSS**: Use CSS Grid/Flexbox over JS math.
  - **CSS Gotcha**: `all: unset` overrides `[hidden]`; always restate `&[hidden] { display: none }`.
- **Dates & Times**:
  - **Frontend Boundary**: Use `@3mo/date-time`'s `DateTime` global for rendering, formatting, and view math (`.equals()`, `.isBefore()`, `.isAfter()`, `.dayStart`, `.format()`). Avoid raw `valueOf()` or year/month math.
  - **Shared/Backend Domain**: Use **Temporal types directly** (`Temporal.Instant`, `Temporal.PlainDate`, `Temporal.ZonedDateTime`). Polyfill injected via `scripts/injectTemporalPolyfill.ts`.
  - **Primitives** (`src/features/time/calendarDate.ts`):
    - `calendarDateOf(instant, zone) -> Temporal.PlainDate`
    - `midnightOf(plainDate, zone) -> Date`
    - `normalizeAllDay(entry)` / `projectAllDay(entry)`
  - **PlainDate Invariant**: NEVER spread a `PlainDate` (fields are prototype getters and spread to `{}`).
  - **iCalendar Boundary**: `ICAL.Time` is strictly isolated to the .ics parse/serialize boundary (`CalDAV.instantFrom` / `toICALTime`). Zoned .ics writes preserve resource VTIMEZONE.
- **i18n & Localization**:
  - Natural English string keys by default: `t('Phrase')`.
  - Dotted symbolic keys (`Namespace.Name` in `en.json`) ONLY for long prose (`Notion.TokenHint`) and command palette search keyword blobs (`GoToDate.Keywords`).
  - All 6 locale dictionaries must be fully translated. Add keys in feature blocks beside related keys.
  - Language switches live through `Localizer.languages.current` (no reload). `i18n/index.ts` re-registers `LocalizerController` on `PageComponent`/`DialogComponent`: lit snapshots a class's initializers at finalize time, so the framework's bases never got the one @3mo/localization installs.
  - Check a natural key is not already taken with another sense before reusing it (`t('On')` is the date preposition — the toggle state is `Toggle.On`).
- **Domain vs View Separation**:
  - Domain records in `src/features/*/` (`Entry`, `Source`, `Integration`) hold persistence/domain state only (e.g. `Entry.persisted`), never layout math.
  - Client layout lives in `src/features/entries/client/`: `EntrySegment` (per-day geometry from `(entry, date, links)`), `EntrySegments` (cross-segment calculations). UI components (`mitra-entry-segment`, `mitra-entry-details`) are view decorations.
- **Calendar Time Grid**:
  - Vertical 1440-row CSS Grid (row index = minute of day, e.g. 9:00 AM = row 540).
  - Dynamic percentage height: `--minute-height: calc(100% / 1440)` on `height: 100%` grid to avoid sub-pixel rounding errors.
  - 2D Scroll: Single scroll container (`overflow: auto`) with `position: sticky` (`top: 0` day headers, `left: 0` time axis, `top: 0; left: 0` top-left corner). No JS scroll sync.
  - Overlaps: Interval Graph Coloring algorithm. JS passes collision data strictly via CSS Custom Properties (`--overlap-slot`, `--overlap-total`) to `<mitra-entry-segment>`. Container queries disable clustering in narrow views.
  - Cross-Day Entries: Split at data layer (`getEntriesForDay`). Never span a single DOM element across midnight. Pass original time range for text, use booleans `continuesNext` / `continuedFromPrevious` to clamp grid rows (1 to 1441) and strip border radii.
- **Popovers & Bottom Sheets** (`components/sheet.ts`, `sheetStyles`, `initializeSheetGestures`):
  - **Opt-In**: Add `data-sheet` attribute and append `--sheet` as LAST fallback in `position-try-fallbacks`. Descendants style via `@container anchored(fallback: --sheet)`.
  - **Single Child Chrome**: The popover host is a transparent scroll track (`::before` is `100dvb` spacer). Surface, border, radius, shadow live strictly on the single child (e.g. `mitra-entry-details > ul`). Child's `::before` is the grab handle.
  - **Host Visibility**: Host must be `display: none` when closed (never `display: contents`).
  - **Dragging & Dimming**: Native scroll tracking (`scroll-snap-type: block mandatory`). Dimmer is a viewport-fixed `::after` animating `opacity` on a named `scroll-timeline`.
  - **Gestures**: Open slides via smooth scrolling to target offset (no CSS transforms or `@starting-style`). Close via `closeSheet(popover)` (scrolls down before dismiss; falls back to `hidePopover()`). Escape keydown intercepted. Delete is abrupt/optimistic.
  - **Delegated Triggers**: `Mitra.initialized()` delegates `scrollend` at offset 0 (requires non-zero scroll range) and press-then-click on track (requires pointerdown on track).
  - **Pre-Sheet Fallbacks**: Inset-based `anchor()` + `justify-self: anchor-center` (`--below`/`--above`), active only at `width >= 40rem`. Sheet body max width `30rem` centered.
  - **Incompatible**: `position-try-order: most-block-size` is forbidden.
  - **Testing**: Test with CDP touch/mouse events, not bare `segment.open = true`.
- **Forms**: Constructors seed empty strings (`""`), never `undefined`, for form-bound fields (`uri`, credentials). Form `merge` methods use `||`, not `??`.
- **Fields vs Content Controls**: `.field` strips chrome from host inputs/textareas/selects, but preserves checkboxes/radios (nested content). `input[type=checkbox]` uses `inline-grid` (prevents whole-line block wrapping in prose).
- **Comments & Architecture**:
  - Comments must explain non-obvious constraints, invariants, or platform traps (1-3 sentences). No line-by-line narration.
  - Update `AGENTS.md` immediately when new architectural decisions are made.
  - Operator docs live in `docs/` (Markdown, Starlight frontmatter, GitHub alerts `> [!NOTE]`, relative links). Sync env vars in `docs/reference/environment-variables.md`, provider docs in `docs/integrations/<provider>.md`, shared guides in `docs/guides/`.

## Backend & Database (MikroORM / SQLite)
- **ORM & STI**: SQLite with MikroORM. Single Table Inheritance (`@entity({ discriminatorColumn: 'type' })`) for polymorphic models (`Integration`, `Entry`). STI subclasses with no new columns need no migration; register in `ormConfig.ts` and `registerIntegrations.ts`.
- **Migrations vs Dev Sync**:
  - `MITRA_DEV=true`: schema diff-sync via `orm.schema.update()`.
  - Non-dev: `migrate.ts` runs `orm.migrator.up()`.
  - Entity changes require: `npm run db:migration:create -- <PascalCaseName>` (generates migration and updates `.schema-snapshot.json`). Autorun via `migrationsList` in `src/infrastructure/database/migrations/index.ts`.
  - Migrations are immutable once committed. Replays run against databases without migration logs; migrations must be safe on fresh schemas (check via `pragma_table_info`).
- **SQLite Table Rebuilds in Migrations**:
  - `pragma foreign_keys = off` is a no-op inside transactions. Dropping a referenced parent table triggers cascading deletes.
  - Rebuild pattern: Copy children into a temporary FK-free holding table, drop child table, drop parent table, recreate final parent and child tables, restore children and FK references (e.g. `user.default_source_id`).
  - Execute sequentially with `await this.execute(...)` (never `addSql`).
- **Entry Type Conversion**:
  - Events (`VEVENT`) and Tasks (`VTODO`) cannot mix in CalDAV resources (RFC 4791).
  - Conversion is re-creation: PUT route creates new entry, deletes old entry, compensates on failure.
  - `status` is gated on incoming type. Recurring series cannot convert (returns 400).
- **Opt-in Source Discovery**: Discovered external sources must be saved with `enabled: false`. Sync entries only when enabled.
- **Enabled vs Visible**: a target an entry may LIVE in is `enabled` (`getEnabledSources()`); `visible` is a VIEW preference and must never remove a destination — a solo ("only show this calendar") once left the editor's source picker with nowhere to move to.
- **Source Reconciliation**:
  - Preserves local renames (`PUT /sources/:id/name`).
  - `Source.remoteName` stores provider's baseline name. Reconcile updates displayed `name` only if remote name actually changed.
- **Data Authority**:
  - **Backend-Owned**: `DTSTART`, `STATUS`, `TRANSP`, `SUMMARY`, `DESCRIPTION`.
  - **Mitra-Owned**: Source colors, order, visibility, availability overrides.
  - **Mirror**: Mitra-owned facts optionally reflected upstream (e.g. `X-MITRA-*`).
  - **Primary Data**: SQLite DB is authoritative for users, sessions, and local overrides.
  - **Relations Graph**: `GET /entries/relations/closure` returns the graph.

## Multi-User & Authentication (OIDC)
- **Modes**:
  - Single-User (default): Zero-auth using seeded `[default_local_user]`.
  - Multi-User: Enabled via env `MITRA_OIDC_ISSUER`, `MITRA_OIDC_CLIENT_ID`, `MITRA_URL` (optional: `MITRA_OIDC_CLIENT_SECRET`, `MITRA_OIDC_SCOPES`). Incomplete config throws in `Oidc.fromEnv`.
- **Relying Party**: Backend OIDC client (`src/features/identity/server/Oidc.ts`, Auth Code + PKCE via `openid-client`, routes `/auth/*`). Supports lazy discovery and HTTP LAN issuers.
- **Sessions** (`src/features/identity/server/Session.ts`): 256-bit cookie token, stored SHA-256 hashed, sliding 30-day expiry, `SameSite=Lax`. Retains `id_token` for RP-initiated logout (`id_token_hint`). Unauthenticated `/api/*` returns 401; page navs redirect to `/auth/login?returnTo=...`.
- **Identity Model**: Value object `Identity` (`src/features/identity/Identity.ts`) with `issuer`, `subject`, `email`, `name`, `picture` URL. Embedded in `User` as nullable `oidc_*` columns (`@embedded`, unique on `['identity.issuer', 'identity.subject']`). `user.identity != null` indicates OIDC user.
- **Provisioning**: `User.provision(em, issuer, claims)` JIT provisions on first login. No automatic data migration from single-user mode.
- **Tenant Isolation**: Routes must scope queries through `User` (`user.integrations`, `user.sources`, `user.entries`). Never use bare `em.find*`. Foreign IDs throw `NotFoundError` (404).
- **User Scoping**: SSE (`syncEmitter.emit('updated', userId)`), Web Push (`userId`), and reminders (`sendTo(userId, ...)`) are isolated per user.

## Integrations & Sync Engine
- **Class Hierarchy & Registration**:
  - `Integration` base class (STI).
  - `registeredIntegrations` (`registerIntegrations.ts`): Imports all connectable classes in display order.
  - Class statics: `label`, `description`, `logo` (asset key for inline SVG), `canConnect` getter.
  - Base constructor sets STI discriminator via `new.target.type`.
- **Integration Types**:
  - **CalDAV** (`integrations/caldav/CalDAV.ts`): Standard remote CalDAV sync engine.
  - **Google Calendar** (`integrations/google/GoogleCalendar.ts`, type `'google'`):
    - Extends `CalDAV`. Overrides `clientParameters()` for OAuth using stored `refreshToken` and env client credentials.
    - Credentials: `{ username: email, refreshToken }`. `toJSON` masks tokens; `merge` is a no-op.
    - Connect Flow (`GoogleOAuth.ts`): Backend PKCE exchange `/api/integrations/google/connect` -> callback -> redirect to `/?integration=<id>`.
    - Limitations: `capabilities.relations = false` (Google CalDAV drops `RELATED-TO` and `X-` properties).
  - **Dev Calendar** (`src/integrations/dev/Dev.ts`, type `'dev'`):
    - Self-contained, local-only calendar (no remote server).
    - `sync()` is no-op, CRUD operations write directly to SQLite. `syncInterval = Infinity`.
    - Seeded via `seedDev(orm)` when `MITRA_DEV=true`.
  - **Notion** (`integrations/notion/Notion.ts`, type `'notion'`):
    - Direct `Integration` subclass (REST API, `Notion-Version: 2026-03-11`). Token PAT auth.
    - Sources: `notion://{dataSourceId}/{viewId}`. Requires status and date properties. Unsupported view types (e.g. feed) are ignored on fetch.
    - Sync: Full membership check (`POST /views/{id}/queries`) + incremental delta query (`last_edited_time` watermark - 2 min). Field diffing via `editEquals`.
    - Capabilities: No recurrence, reminders, location, cancelled status, or time zone.
    - Time Zone: Always `timeZone: null` (Notion API returns fixed offsets; dates paired with naive wall-clock).
    - Description: Bi-directional markdown body sync via `NotionMarkdown.ts` (using `marked`, max nesting depth 2). Replaces only `isReplaceable` blocks (preserves embeds, images, synced blocks).
    - Rich text: Reads extract text via `NotionMarkdown.textOf`. Date mentions format `mention.date` (`YYYY-MM-DD HH:MM`, ranges joined by `→`).
    - Bookmarks: Read as `[caption or url](url)`. Standalone link lines serialize back as `bookmark` blocks. Media/embed blocks remain untouched.
    - Round-Trip: Empty paragraph padding and trailing spaces stripped so clean markdown round-trips without phantom diffs.
    - Filter Defaults: `Notion.deriveFilterDefaults` pre-fills view filter properties on task create. Tasks not matching view filter are not retained locally.
    - Relations: Maps self-referencing relations ("Parent Task" -> `PARENT`, "Blocked by" -> `FINISHTOSTART`, custom -> `X-NOTION-<NAME>`). Non-self relations ignored. Dual properties map only stored direction.
  - **ICS Feeds** (`integrations/ics/`, type `'ics'`):
    - 1 Feed = 1 Integration holding 1 Source. `webcal(s)://` normalized to `https://`.
    - Entities keyed by UID (or content hash). Change detection via raw VCALENDAR hash.
    - Polling: Conditional GET (304) with SHA-256 body hash backstop.
- **Read-Only Calendars & ACL**:
  - `Source.readOnly` (nullable). CalDAV reads `current-user-privilege-set` via `CalDAV.writableFromPrivileges` (`undefined` = writable).
  - Shared Google calendars must be enabled at `calendar.google.com/calendar/syncselect`.
  - UI: Editor fields render selectable `readonly` text (not `disabled`). Mutation controls hidden. Time zone lens remains active.
- **Sync Pacing & Presence** (`SyncPacer.ts`):
  - Largest interval wins: presence cadence (10s online, 5min offline via `presence.ts`), provider `syncInterval` (Google/Notion = 60s, Dev = `Infinity`), or flat 60s failure rest.
  - User coming online triggers immediate scoped sync. No manual "Sync Now" button or endpoint.
- **Sync vs Re-import**:
  - **Sync**: Background incremental pull (`Integration.sync`, no client button).
  - **Re-import**: Full wipe and rebuild (`POST /api/sources/:id/reimport`, icon `hard-drive-download`).
- **CalDAV Protocols & Edge Cases**:
  - Multiget batch fallback: Tolerates 404s by falling back to individual fetches.
  - Date Writes (`CalDAV.writeDate`): Preserves authored form (TZID -> wall clock in VTIMEZONE; zoneless -> UTC). Series start shift shifts override `RECURRENCE-ID`s.
  - Concurrent Edits (412): Route all writes through `CalDAV.writeResource(entry, applyTo)`. Retries once on 412 with fresh ETag.

## Bulk Migration (Move / Copy Entries Between Calendars)
- **3-Phase Architecture** (`src/features/sources/server/SourceMigration.ts`):
  1. **Copy**: Create all entries in target, collect old-uid -> new-uid map for target-minted IDs (e.g. Notion page IDs).
  2. **Repoint**: Rewrite `EntryRelation.targetUid` across batch using map; relations pointing outside batch remain untouched.
  3. **Delete**: Delete originals from origin (skipped if `keepOriginals: true`).
- **Ordering & Safety**: No cross-provider transaction. Copy failure rolls back copies and aborts before delete; delete failure leaves recoverable duplicates (never loss).
- **Copy vs Move** (`keepOriginals`): Skips phase 3 and mints fresh UIDs for copies. Phase 2 still runs, SCOPED: a move rewrites every row pointing at a departing UID; a copy rewrites only the copies' own rows, so a copied pair is a linked pair and the originals keep pointing at each other. A link whose target was not copied is left alone either way. Read-only origins permit copy but refuse move.
- **Concurrency Locks**: `Integration.exclusivelyAcross(ids, work)` sorts and deduplicates integration IDs to avoid deadlock.
- **Fidelity Preview** (`src/features/sources/MigrationPlan.ts`): Projected from `capabilitiesFor(target)`. `MigrationBlocker` (recurrence, occurrence override pinning, participants, transparency, visibility, percentComplete) vs `MigrationLoss` (reminders, location, description, timeZone, allDay, cancelledStatus, type). Wire plan transmits only non-clean verdicts; `cleanCount = total - verdicts.length`.
- **Series Handling**: Refused if target lacks recurrence unless user explicitly selects `flatten: true` (writes `FLATTEN_HORIZON_DAYS = 366` single occurrences via `Occurrences.of(master)`).
- **Data Boundary**: `data.raw` never travels (strips origin sync data/ETag). Exclusions travel as `exdates` column via `exdatesOf`.
- **API Routes**: `POST /api/sources/:id/migrate/preview` and `POST /api/sources/:id/migrate` (`{ targetSourceId, entryIds?, keepOriginals?, flatten? }`). Returns 200 with `MigrationOutcome` report even on abort.
- **UI** (`DialogSourceMigration.ts`): Driven by `@lit/task` `Task` states (target picker -> series decision cards -> preview report -> outcome report).

## Sources & Entry Types
- **Type Declaration**: Sources declare supported types via `Source.entryTypes` array (`'event'`, `'task'`). Source identity is `uri` alone.
- **EntryType Value Object** (`src/features/entries/EntryType.ts`):
  - `EntryType.Event` (`'event'`) and `EntryType.Task` (`'task'`).
  - MikroORM custom type `EntryTypeType` (`src/features/entries/server/EntryTypeType.ts`).
  - Assigning `Entry.type` performs conversion.
  - Format methods: `EntryType.format()` / `formatPlural()`.
- **Undated Entries & Unscheduled Section** (`mitra-unscheduled`):
  - Only tasks can be unscheduled (`Entry.unschedulable`).
  - Scheduling and unscheduling share `EntryDragController.move`.
  - Drawer tabs: `src/design/Tabs.ts` (declarative, scroll-driven).
  - Chip height tiers: roomy-first, cramped as exception via `--density`.

## Calendar Views & Layout Engine
- **Layout Architecture**:
  - View Components: `Days` (`mitra-days`, week), `Weeks` (`mitra-weeks`, month), `Months` (`mitra-months`, year), `Timeline` (`mitra-timeline`, task planning band).
  - `EntrySegments` Engine:
    - `EntrySegments.for(entry)`: Memoized per-day segments with `previous`/`next` links.
    - `timedOn(day)`: Clustered side-by-side columns.
    - `runsIn(from, to, accept)`: Representative segments touching window via per-cohort `segmentsByDay` index.
    - `monthSlots` / `allDaySlots` / `monthWeek(week)`: Unbounded greedy lane packing (no slot caps; overflow clips behind bottom fade).
    - `static laneRank(entry)`: Lane ordering for month packing.
  - Self-Placement: Views map dates to grid columns via `Map<dayValue, index>`.
  - Hot-Loop Date Math: Cache `.dayValue` (`YYYYMMDD` integer) or `epochMilliseconds` in tight loops.
- **Gestures & Controllers**:
  - `EntryDragController`: Container-level controller for create, move (delta translation), and resize (edge drag). Resize handles: 0.25rem strips (`resize: 'block' | 'inline'`).
  - Drafts: Single active local draft in `EntryStore.draft` (`id = 0`, `persisted = false`). Backend assigns final IDs.
  - `CalendarScrollController`: Date-anchored scrolling across views. Snapping gated on device type (notched wheel vs continuous touch/trackpad).
  - `DensityController`: Shared zoom gesture (Ctrl+wheel, wheel over rail, 2-finger pinch). Subclasses override `settled()` to dispatch synthetic scroll on inner scroller elements.
  - `TimeZoneLaneController`: Alternative zones fold; anchor zone never folds. Clamps cells (`max-inline-size: var(--zone-width)`). Rail inline drag with `touch-action: pan-y`.
  - Week All-Day Lane: Explicit row tracks (`grid-template-rows: repeat(var(--slots), var(--slot-height))`), never auto-flow.
- **Month View** (`mitra-weeks`):
  - Strip of week rows with subgrid column alignment and continuous CSS density scaling (`--_month-density`).
  - Row Structure: Numerals track + `.entries` overlay (unbounded lanes, `overflow: hidden` + gradient bottom fade). Routines ribbon rendered in track after last bar.
  - Stacking Context: Explicit `z-index: 2` on `.entries` to preserve stacking order over relations connectors (z: 1 resting, z: 3 hover).
  - Caching & Rendering: Per-week layout memo (`weekLayouts` keyed on routines cohort) with `guard()`ed week templates.
  - Week-Number Rail: Leading track (`--_week-rail-width`) in header and canvas. Click dispatches navigation and view switch. `[data-week-numbers]` collapses rail when undefined. Numeral is block-sticky inside cell.
  - Zoom Engine (`WeeksDensityController`): Bounds 2–9 weeks (min row 4.5rem). Multiplies ideal height (`--month-zoom`). `[data-zooming]` enables granular tracking during gestures; settles via whole-row quantization glide before returning authority to CSS integer fitting.
- **Yearly View** (`mitra-months`):
  - Horizontal strip of `mitra-day` mini-month cells.
  - Month metadata from `CalendarDatesController.months`.
  - CSS subgrid overlay for lanes; overflow clips.
  - Zoom via `MonthsDensityController` (extends `DensityController`). `overflow-anchor: none` on host scroller.
- **Timeline View** (`mitra-timeline`):
  - Open scheduled tasks only, 1 row per task, sorted chronologically. Virtualized based on plan, not scroll position.
  - Arrival placement: `CalendarScrollGeometry.arrived`.
  - Routines show only due occurrences (today + upcoming window).
  - Bar text renders outside bar. Transparent canvas.
  - Sticky `.jump` buttons on viewport edges when task bar scrolls out of view.
  - Zoom via `TimelineDensityController`.

## View Transitions
- **Engine**: `src/features/calendar/client/calendarTransition.ts` (`transitionCalendar`).
- **Scope**: Scoped `element.startViewTransition` on `.calendar` container (Chromium 147+). Used for view navigation and source visibility changes only (not background SSE).
- **Naming**: Capped to top 40 entries nearest center; paired only on target view. Calendar grid frame is named to isolate stacking contexts.
- **Overlay CSS**: `::view-transition { pointer-events: none }`.

## Commands & Command Palette
- **Command Architecture** (`src/features/*/client/commands/`):
  - 1 class per action extending `Command`.
  - Facts are `abstract readonly` fields (not getters) for static data (`heading`, `keywords`, `keys`). Getters reserved for live state (`NextPeriod.heading`, `keyLabels`). Members with defaults (`shortcutLabel`, `keyLabels`, `matches`) are accessors.
  - Context resolved dynamically via `Mitra.instance.calendar` (public properties on `PageCalendar`).
  - Execution: Always run via `Command.dispatch()` to catch and absorb `DialogCancelledError`.
  - Non-Command Actions: Pointer gestures and editor-specific shortcuts stay in their own components.
- **Command Palette** (`mitra-command-palette`):
  - Pure view. Filters via `commandMatches` → `termsMatch` (`src/features/commands/termsMatch.ts`, the app's ONE search rule — also the settings dialog's; kept out of `Command.ts` so searching doesn't drag in the app root).
  - Navigation: Native `<dialog closedby="any">`. Triggered by bare `/`, `Ctrl+P`, or `Ctrl+K`.
  - Search: Unwindowed backend `GET /entries/search?q=` (SQL LIKE, limit 20, 200ms debounce).
  - Selection: Emits `navigate` and requests editor open via `EntryEditorIntent.requestOpen(id)`.
- **Editor Intent** (`src/features/entries/client/EntryEditorIntent.ts`):
  - Holds transient view intent for target editor (`openDraft(draft)` or `requestOpen(id)`).
  - `EntrySegment.updated` opens run-start segment (`!hasPrevious`) and consumes intent. `settle(entries)` clears unmatched intents.
- **Keyboard Interceptor** (`PageCalendar.handleKeyDown`):
  - Must ignore inputs (`<input>`, `<textarea>`, `<select>`, `[contenteditable]`), IME composition, modifier chords, and open dialogs (`e.composedPath()` has `HTMLDialogElement`).
- **Registry Instances**: `commandInstances()` caches one instance per class and rebuilds them when the language changes (facts are stringified at construction). Never `new` the registry per render.

## Settings
- **Architecture** (`src/features/settings/client/Setting.ts`):
  - 1 class per preference co-located with target feature (`ThemeSetting`, `LanguageSetting`, `DefaultViewSetting`, etc.).
  - `src/app/settings.ts` defines registration order only; `src/features/settings/` houses infrastructure and `UserSettings.ts`.
  - Settings own defaults and options (e.g. `SnapSetting.choices`). Domain functions accept preferences as parameters.
  - Server/client boundary: Server bundle excludes client settings (`bundles.test.ts` enforcement).
  - Storage strategies: `userStorage` (persisted on server `User.settings` JSON via `PUT /api/user/settings`) or `deviceStorage` (`localStorage`). Only deviations from code defaults are persisted (`undefined` removes record; `null` represents explicit "none").
  - `UserSettings` shared entity sanitizes JSON payload without importing UI setting definitions.
  - `Setting.details`: Optional full-width slot beneath row for complex state (e.g. `<mitra-notification-devices>`). Setting classes return component tags when reactive lifecycles are needed.
- **Palette & Dialog Bridge** (`src/features/settings/client/commands.ts`, `DialogSettings.ts`, `SettingRow.ts`):
  - Settings contribute action verbs or dialog shortcut commands to command palette (`settingCommands()`).
  - Searchable two-pane dialog (pages: `general`, `calendar`, `entries`, `notifications`, `administration`).
  - Native standalone controls; active palette focus marked with focus ring (`ring` from `focusRing.css.ts`, color declared locally). Search groups match sidebar section styling (0.75rem/600 muted).
  - Scroll containers require explicit inline padding to prevent clipping focus rings at padding boxes.
  - Entry points: sidebar footer (account gear in multi-user mode), command palette, and `Ctrl/⌘+,` chord (handled via window listener on `Sidebar`, documented in shortcut sheet).

## Recurrence & Routines (RFC 5545)
- **Recurrence Model**:
  - Single master entry with `RRULE` in `Entry.recurrence` (`Recurrence` value object, `src/features/recurrence/Recurrence.ts`).
  - Occurrences expanded on read via `expandRecurrence`.
  - Edited exceptions sync as individual rows with `RECURRENCE-ID` and `recurrenceMasterId`.
  - Edits currently apply series-wide via dedicated recurrence API routes.
  - A scoped edit may ALSO change the calendar, and the two compose (`editOccurrence`'s `movingTo`): 'this' detaches the occurrence INTO the target, 'following' starts the continuation there (the old half stays), 'all' re-creates the whole series there — same uid, rule and exclusions — and deletes it here, create-first. The client must send `sourceId` with the scoped PUT; without it the picker changed and nothing moved.
- **Routines (Density Collapse)**:
  - Dense cohorts collapse into compact ribbons in month/year views.
  - Layer above recurrence: entries sharing appearance (`sourceId`, `heading`) pool into one routine (series, overrides, detached check-offs, all-day placeholders). Blank headings fall back to per-master.
  - Gate: `min(member rule strideDays, median observed day gap) < rowUnitDays * slack` with >= 4 instances in window. Slack: week = 1.0 (weekly stays bars), month = 1.25 (collapses ~5-week cadences).
  - Rendering: 1 ribbon mark per active day (never spanning bars). Modifies `mitra-entry-segment` with `.routine`.

## Reminders & Notifications (Web Push, RFC 8030)
- **Anchor Semantics**:
  - `Entry.reminders` count minutes before `Entry.reminderAnchor` (`start`, falling back to `end` for due-only tasks). `unschedule()` clears reminders.
  - CalDAV TRIGGER `RELATED`: `START` by default, `END` for due-only tasks (`CalDAV.reminderAnchorOf`). Reads and writes share anchor mapping to preserve unmanaged alarms.
- **Delivery Guarantees & Bundling**:
  - Push headers set `TTL` (`anchor + 5 min` grace) and `urgency: 'high'` (bypasses Android Doze, prevents stale queue delivery).
  - `ReminderNotification` (`src/features/reminders/ReminderNotification.ts`): Dependency-free model bundled into service worker (`scripts/esbuild.ts`).
  - Service worker re-renders body on arrival via `bodyAt(Date.now())` (fallback to static body).
- **Scheduler Engine** (`ReminderScheduler`):
  - Ticks claim `(watermark, now + interval]` window and schedule exact timers (`setTimeout`).
  - Persistent watermark (`reminder.watermark` state key) advances to `now` for crash recovery; in-memory `dispatched` map deduplicates.
  - Query bounds: `start > watermark - ZONE_SLACK` (or `end` for due-only tasks).
  - Observer time zone: `NotificationSubscription.timeZone` / `lastSeenAt` tracked per device to resolve floating wall-clock times (`Reminders.anchorInstant`).
- **Device Management Surface**:
  - Subscriptions listed under Settings → Notifications via `NotificationsSetting.details` rendering `<mitra-notification-devices>`.
  - Push endpoints serve as device identifiers for active client highlighting and revocation.

## Participants (RFC 5545 / 5546 iTIP, RFC 6638)
- **Storage & Capability**:
  - `Entry.participants` JSON column holding `Participants` collection.
  - Provider capability: `Integration.capabilities.participants` (disabled for Notion).
- **Permissions**: Enforced in backend; only organizer may modify attendee list.
- **Identity & Mapping**:
  - User identity: `Integration.addresses` resolved from CalDAV principal.
  - CalDAV mapping: Pure statics `CalDAV.participantsFrom` / `writeParticipants`.
  - UI: `mitra-participants-field` in entry editor popover.

## Relationships (RFC 9253 / RELATED-TO)
- **Model & Vocabulary**:
  - Vocabulary: `RelationType` value objects (`PARENT`, `CHILD`, `FINISHTOSTART`, `STARTTOFINISH`, `STARTTOSTART`, `FINISHTOFINISH`, `DEPENDS_ON`, `CUSTOM`).
  - Domain: `Relation`, `EntryRelations`, `EntryRelation` entity.
  - Storage: Stored on dependent entry (`PARENT` on child, `FINISHTOSTART` on dependent) referencing entry `uid` strings.
- **Operations**:
  - Shift Strategy (`ShiftStrategy.ts`): Propagates date movements to dependents.
  - CalDAV Sync: `CalDAV.writeRelations` performs line-level diff on `RELATED-TO`.
  - Persistence: Dedicated endpoint `POST /api/entries/:id/relations`; excluded from standard entry dirty checking.
  - Migrations: Rebuilding `entry` table requires holding `entry_relation` rows in a temp table.
  - Closure API: `GET /entries/relations/closure` returns graph for connected entries.
- **Task Progress Rollup** (`RelationGraph.rollupOf`):
  - Steps combine subtasks and GFM `- [ ]` description checklists (`Checklist`, `src/features/entries/Checklist.ts`, `Entry.checklist`). Additive with equal weight (3 boxes + 2 subtasks = denominator of 5).
  - `EntryRollup` provides aggregated sums (`done`, `total`, `progress`) and segregated tallies (`subtasks`, `checklist`).
  - Readout labels adapt by active step types: subtasks only, checklist only, or neutral "steps" when mixed.
  - Checklists apply strictly to tasks; `ancestorsCompletedBy` requires all checklist items complete.
  - Ticking a box mutates description text via `Checklist.toggle` in-place without touching `status` or `percentComplete`.
  - Round-trips through CalDAV `DESCRIPTION` and Notion `to_do` blocks (`NotionMarkdown`).
- **Markdown Task Lists** (`src/design/Markdown.ts`):
  - `MarkdownRenderer.listitem` lifts checkbox and wraps remaining content in `.label` (keeps inline formatting within a single grid column).
  - `mitra-markdown[interactive]` removes `disabled` and numbers checkboxes in document order (matching `Checklist` line indexing). Emits `check` event on toggle (avoids collision with native `toggle` event).
  - Checkbox dimensions sized in `em` to match prose line-height.
- **UI & Connector Arrows** (`EntryConnections.ts`):
  - SVG router routes by grid columns (not dates).
  - Realm separation: Lane layer draws lane<->lane edges; canvas layer draws timed<->timed and cross-realm edges (via scroll-driven CSS animation timeline / offset correction).

## Sidebar & Navigation
- **Source Icon**: `<mitra-source-icon>` (`src/features/sources/client/SourceIcon.ts`) is the unified icon component.
- **Sidebar Grid**: Single CSS grid (`.integrations`) aligns all source rows, headings, and gutters across providers. Its `--sidebar-gap` is both the column gap and (the first column being zero-wide) a row's content inset — the Planning tab's heading takes it too, so every heading in the sidebar rides one column. Anything listing sources elsewhere (the migration dialog) reproduces that relationship: heading text starts where the row icons do.
- **Gutter**: Scroller uses `scrollbar-gutter: stable` to prevent layout shifts.
- **Primary Source**: Always resolve via `getPrimarySource()` (default source or first visible), never raw ID.
- **Ordering**: `Source.order` column (nullable integer).
- **Row Actions**: Source visibility eye toggle is the trailing action.

## Build, Test & CI/CD
- **Runtime**: Node 25+ required (Temporal API).
- **Type Checking**: Run `tsgo` (`node_modules/@typescript/native-preview-<platform>/lib/tsgo --noEmit`). esbuild does not typecheck.
- **Linting**: `npm run lint` (`eslint .`, ESLint 9 flat config). Enforces tabs, single quotes, no semicolons, a trailing newline (`eol-last`), `max-lines` 1000 per file (split like `CalDAV.<topic>.test.ts`), `no-console` (except `warn`/`error`).
- **Tests**: `npm test` -> `scripts/test.ts` (esbuild bundles `src/**/*.test.ts` -> `out_test/`, runs `node:test`).
- **Development**: `npm start` -> `scripts/dev.ts` (`tsgo --watch` + esbuild watch).
- **Production Build**: `npm run build` -> `scripts/build.ts`. Shared esbuild config in `scripts/esbuild.ts`. Requires `data/` directory.
- **Docker**: Multi-stage `Dockerfile` based on `node:25-bookworm-slim`. Published to `ghcr.io/a11delavar/mitra`.
- **CI / Workflows**:
  - `.github/workflows/qa.yml`: Parallel typecheck (`tsgo`), lint (`eslint`), and test (`npm test`).
  - `.github/workflows/docker.yml`: Git-tag driven multi-arch build via `docker/metadata-action`.
  - `.github/workflows/release.yml`: Publishes GitHub Release from top section of `CHANGELOG.md`.
  - `.github/workflows/cleanup.yml`: Prunes untagged GHCR manifests.
- **Changelog**: `CHANGELOG.md` generated via git-cliff (`npm run changelog`, `cliff.toml`).

## Conventions
- **Commit Messages**: Single-line `type: Capitalized phrase` (`feat:`, `fix:`, `perf:`, `refactor:`, `docs:`, `test:`, `ci:`, `build:`, `infra:`, `chore:`). Commit subject becomes the user-facing release note in `CHANGELOG.md`; state the end-user effect, not implementation mechanics.
- **Formatting**: Indent with tabs. No semicolons. Files end with a single trailing newline.
- **License**: AGPL-3.0-only (`LICENSE`, `package.json`).
- **Privacy & Placeholders**: No real-world people names or initials in code, tests, or seeds. Use role-based placeholders (`organizer@example.com`, `me@example.com`).
- **Architecture**: Domain-Driven Design and OOP. Business logic belongs on aggregate roots, value objects, and domain collections, not loose procedural helper functions.
- **Comment Brevity & Quality**: Never write verbose, essay-style JSDocs, conversational prose, or line-by-line narrations. Code should be self-documenting. Keep comments strictly focused on non-obvious domain invariants, RFC/protocol edge cases, or platform bugs, distilled into 1–2 concise, high-signal sentences.
