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
  - All 7 locale dictionaries must be fully translated. Add keys in feature blocks beside related keys.
  - Language switches live through `Localizer.locales.current` (no reload), an `Intl.Locale` that adopts the browser's region for the chosen language (`en` → `en-GB`). Hand it whole to `Intl` formatters, as `DateTime` does; `.language` is the dictionary key (push registration, the setting). `Localizer.languages` is deprecated. `i18n/index.ts` re-registers `LocalizerController` on `PageComponent`/`DialogComponent`: lit snapshots a class's initializers at finalize time, so the framework's bases never got the one @3mo/localization installs.
  - Check a natural key is not already taken with another sense before reusing it (`t('On')` is the date preposition, the toggle state is `Toggle.On`).
  - Let the Localizer do the grammar, never branch on a language: plurals are dictionary arrays (`Every ${count:pluralityNumber} weeks` → `["Every week", "Every … weeks"]`, the singular being the interval-less phrase), a number parameter formats its digits, an array its list (`array.format()`), and ordinals pick their dictionary form by `Intl.PluralRules({ type: 'ordinal' })` (`Recurrence.ordinal`).
  - Never interpolate a raw number into a template: `count.format()`, `value.formatAsPercent()` (0–100, Intl places the sign), `date.format({ day: 'numeric' })`, or a `t()` parameter, so Persian gets its own digits. A key never carries a literal `%`.
  - **Fonts**: shipped from `dist/`, never a CDN. `src/app/fonts.css` (its own esbuild entry, `.woff2` as files, linked from `index.html`) imports Fontsource's Inter and Vazirmatn, and `--font-family` stacks them. A face only downloads once text in its `unicode-range` appears, so Latin never fetches Vazirmatn.
  - Integration `static label`s are localized at render (`t(integrationClass.label)`) and scanned like `description`s. The instance name is `instanceName()`: an operator's `MITRA_NAME` verbatim (only sent when set), else `t('Mitra')`.
- **Domain vs View Separation**:
  - Domain records in `src/features/*/` (`Entry`, `Source`, `Integration`) hold persistence/domain state only (e.g. `Entry.persisted`), never layout math.
  - Client layout lives in `src/features/entries/client/`: `EntrySegment` (per-day geometry from `(entry, date, links)`), `EntrySegments` (cross-segment calculations). UI components (`mitra-entry-segment`, `mitra-entry-details`) are view decorations.
- **Calendar Time Grid**:
  - Vertical 1440-row CSS Grid (row index = minute of day, e.g. 9:00 AM = row 540).
  - Dynamic percentage height: `--minute-height: calc(100% / 1440)` on `height: 100%` grid to avoid sub-pixel rounding errors.
  - 2D Scroll: Single scroll container (`overflow: auto`) with `position: sticky` (`top: 0` day headers, `left: 0` time axis, `top: 0; left: 0` top-left corner). No JS scroll sync.
  - Overlaps: Interval Graph Coloring algorithm. JS passes collision data strictly via CSS Custom Properties (`--overlap-slot`, `--overlap-total`) to `<mitra-entry-segment>`. Container queries disable clustering in narrow views.
  - Cross-Day Entries: Split at data layer (`getEntriesForDay`). Never span a single DOM element across midnight. Pass original time range for text, use booleans `continuesNext` / `continuedFromPrevious` to clamp grid rows (1 to 1441) and strip border radii.
- **Popovers, Dialogs & Sheets** (`design/Popover.ts`, `design/ModalSheet.ts`):
  - **One popover, three presentations**: `mitra-popover` is anchored where there is room, centered where there is none (the `--centered` rung, pure CSS, no JavaScript), and with `sheet` a modal bottom sheet below `40rem` (`[data-sheet]`, a `mitra-modal-sheet` on 3MO's `SheetController`). Its content is slotted, so switching presentation never rebuilds it.
  - **Entry editor**: `mitra-entry-details` is `display: contents` and renders `<mitra-popover sheet>` around its `.editor`, which carries the surface, border and radius. It anchors at its segment through `show(segment)`; `close()` hides it (a sheet slides away). Its placement chain is `flip-inline, --centered` (beside its segment, else a dialog; no above/below rungs), declared on its popover from its own stylesheet, which therefore includes `centered` (`@position-try` names are tree-scoped).
  - **Sheet focus**: the sheet's dialog takes focus as it opens unless something inside has `[autofocus]`, never its first control.
  - **Incompatible**: `position-try-order: most-block-size` is forbidden.
  - **Testing**: Test with CDP touch/mouse events, not bare `segment.open = true`. The editor is open when its popover reflects `open` (`mitra-entry-details:has(> mitra-popover[open])`).
- **Forms**: Constructors seed empty strings (`""`), never `undefined`, for form-bound fields (`uri`, credentials). Form `merge` methods use `||`, not `??`.
- **Fields vs Content Controls**: the entry editor's rows (`.field`, `entries/client/editorFields.css.ts`, scoped to `mitra-entry-details`, never global) strip chrome from the inputs, textareas and selects inside and anchor their pickers to the whole row. Every checkbox is `mitra-checkbox` (including Markdown task lists, caught by `mitra-markdown` on capture-phase `change`).
- **Comments & Architecture**:
  - Comments must explain non-obvious constraints, invariants, or platform traps (1-3 sentences). No line-by-line narration.
  - Update `AGENTS.md` immediately when new architectural decisions are made.
  - Operator docs live in `docs/` (Markdown, Starlight frontmatter, GitHub alerts `> [!NOTE]`, relative links). Sync env vars in `docs/configuration.md`, provider docs in `docs/integrations/<provider>.md`, everything else in `docs/` itself (views in `docs/views/`).

## Design Library (`src/design`)
Feature components compose design primitives and hold domain logic only. Registered via `design/index.ts`.
- **Boundary**: `src/design` imports nothing from features or infrastructure (`design/boundary.test.ts`). Exception: `Dialog.ts` -> `Mitra.styles` for shadow top-layer styling.
- **Shadow DOM Primitives**: Controls are shadow DOM with `:host([attr])` state and exposed `part`s (no `Mitra.ts` registration). Feature components remain light DOM.
- **Controls & Events**: Base `Control` delegates focus to internal native inputs and respects `autofocus`. Controls re-emit composed `change` events; bind with `live()`. A control carries `:state(focus-visible)` while its inner control has keyboard focus, for a context that rings it from outside (`:has(:focus-visible)` stops at the shadow root); the editor's rows ring themselves and zero the field's own ring (`--mitra-field-ring`). Event guards must use `startedInField`/`startedOnControl` (`eventOrigin.ts`, `composedPath()`), never `target.closest()`. Gestures skip events that `startedInOverlay` (a popover's events bubble through whatever hosts it).
- **Selects & Comboboxes**: `mitra-select` is an ARIA combobox hosting slotted `<mitra-option>`s via button + listbox; exposes `::part(listbox)` and reflects `open` for `.field` rows. `mitra-combobox` supports `floating` (manual popover) and `inline` (in-flow for pickers/palettes; Escape fires `dismiss`).
- **Overlays**: `mitra-popover` is its own popover host; a subclass declares its `popoverType` (`'manual'` for a floating listbox, `null` for an inline one), which a presentation switch restores, never a blanket `'auto'`. `mitra-popover-container` pairs trigger and popover (`display: contents`, invoker binding without IDs). `--mitra-surface` tints nested popovers. Pickers render their content from their first opening (`beforetoggle`): every entry editor holds several closed ones.
- **Date, Time & Text Fields**: Segmented `mitra-date-field`/`mitra-time-field`/`mitra-date-time-field` (`SegmentedField`) follow app locale; a date field's value is a `DateTime` read in its `timeZone` (the system's unless given; the editor passes its lens, the repeat end `UTC`), handed to its 3MO controller, whose `navigationDate` the picker stands on (today in that zone while empty) and whose `pick` commits a day's start there. Pickers `mitra-date-picker`/`mitra-time-picker`; the date-time field shows both and edits a draft (a time picked or the picker closed commits, Escape drops). Date units expose `part`s `date`/`time`, muted while showing `impliedDate` (`:state(implied)`, live with drafts and typing); slotted row actions sit at the box's end. `@3mo/segmented-input` gives each group `dir="auto"`: digits alone read left to right in any script (a Persian date), a right-to-left word turns it (a Persian duration), and the arrows follow. Base `InputField<T>` backs `mitra-text-field` (bound on `input`), `mitra-search-field`, and `mitra-number-field` (clamped on `change`). `mitra-duration-field` (minutes, an hour and a minute segment on `@3mo/segmented-input`, presets as its picker) lists its presets in `slots` rows, as the time picker does. `plain` drops the box for a search that heads a picker (time zones, relations); the picker draws the hairline beneath it.
- **Shared Fragments** (`*.css.ts`): Reusable state fragments (`fieldChrome`, `optionRow`, `selected`, `disabled`, `pressable`, `scrollbar`). `selected` is the single source of truth for active items. Interpolations must use `unsafeCSS(...)` on template strings (tagged templates reject arguments).
- **Field Context**: a context that wears the box itself (the editor's rows) sets `--mitra-field-*` (border, background, padding, picker button, read-only opacity, select indicator), and the design fields drop their chrome; an overlay opened from there (`mitra-dialog`, `mitra-popover` and so every picker) restores them (`fieldChromeRestored`).
- **Sheets & Dialogs**: `mitra-modal-sheet` is a modal `<dialog>` sheet on 3MO's `SheetController` (the phone sidebar, and `mitra-popover`'s sheet presentation). Content laid out while closed has zero dimensions (`mitra-tabs` re-reveals on resize). Standalone `mitra-dialog` renders in place so invoker popovers stay open. It announces `pageHeadingChange` only while `boundToWindow` (popped out): rendered in place, its bubbling heading would rename the tab even closed.

## Backend & Database (MikroORM / SQLite)
- **ORM & STI**: SQLite with MikroORM. Single Table Inheritance (`@entity({ discriminatorColumn: 'type' })`) for polymorphic models (`Integration`, `Entry`). STI subclasses with no new columns need no migration; register in `ormConfig.ts` and `registerIntegrations.ts`.
- **Migrations vs Dev Sync**:
  - `MITRA_DEV=true`: schema diff-sync via `orm.schema.update()`, and the Demo integration is offered.
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
- **Enabled vs Visible**: a target an entry may LIVE in is `enabled` (`getEnabledSources()`); `visible` is a VIEW preference and must never remove a destination. A solo ("only show this calendar") once left the editor's source picker with nowhere to move to.
- **Source Reconciliation**:
  - Preserves local renames (`PUT /sources/:id/name`).
  - `Source.remoteName` stores provider's baseline name. Reconcile updates displayed `name` only if remote name actually changed.
- **Data Authority**:
  - **Backend-Owned**: `DTSTART`, `STATUS`, `TRANSP`, `SUMMARY`, `DESCRIPTION`.
  - **Mitra-Owned**: Source colors, order, visibility, availability.
  - **Mirror**: Mitra-owned facts optionally reflected upstream (e.g. `X-MITRA-*`).
  - **Primary Data**: SQLite DB is authoritative for users, sessions, and local overrides.
  - **Relations Graph**: `GET /entries/relations/closure` returns the graph.

## Multi-User & Authentication (OIDC)
- **Modes**:
  - Single-User (default): Zero-auth using seeded `[default_local_user]`.
  - Multi-User: Enabled via env `MITRA_OIDC_ISSUER`, `MITRA_OIDC_CLIENT_ID`, `MITRA_URL` (optional: `MITRA_OIDC_CLIENT_SECRET`, `MITRA_OIDC_SCOPES`). Incomplete config throws in `Oidc.fromEnv`.
  - Demo (`MITRA_DEMO=true`, wins over OIDC): the `visitor` strategy opens a `Sandbox` (`demo-<uuid>` user holding a synced `Demo` integration) where multi-user mode would ask for a sign-in. A sandbox lives `Sandbox.lifetime` (24 h) from the visit that opened it, and past `Sandbox.cap` (`MITRA_DEMO_CAP`, 1000 by default) the oldest go too, both as the next one opens. Its age is its session's, written in the same flush (sessions only renew past half their 30 days). Dotted paths outside `/api/` never open one, so an asset fetch leaves nothing behind. Connecting is refused (403) and `meta.demo` hides its entry points (`Command.available`, the sidebar button).
- **Relying Party**: Backend OIDC client (`src/features/identity/server/Oidc.ts`, Auth Code + PKCE via `openid-client`, routes `/auth/*`). Supports lazy discovery and HTTP LAN issuers.
- **Sessions** (`src/features/identity/server/Session.ts`): 256-bit cookie token, stored SHA-256 hashed, sliding 30-day expiry, `SameSite=Lax`. Retains `id_token` for RP-initiated logout (`id_token_hint`). Unauthenticated `/api/*` returns 401; page navs redirect to `/auth/login?returnTo=...`.
- **Identity Model**: Value object `Identity` (`src/features/identity/Identity.ts`) with `issuer`, `subject`, `email`, `name`, `picture` URL. Embedded in `User` as nullable `oidc_*` columns (`@embedded`, unique on `['identity.issuer', 'identity.subject']`). `user.identity != null` indicates OIDC user.
- **Provisioning**: `User.provision(em, issuer, claims)` JIT provisions on first login. No automatic data migration from single-user mode.
- **Tenant Isolation**: Routes must scope queries through `User` (`user.integrations`, `user.sources`, `user.entries`). Never use bare `em.find*`. Foreign IDs throw `NotFoundError` (404). `EntryRelation` has no user column and shared calendars share UIDs: `targetUid` matches stay in the user's sources (`EntryRelation.repoint`, relation graph); so do location recents. Push endpoints are unique: another user's registration takes the row, never the device name.
- **Error Handling**: Central error handler in `src/app/server.ts` maps `NotFoundError` to 404, preserves `error.status`/`statusCode` in range 400–599 (from `http-errors` / Express parsers), and defaults to 500 for unhandled exceptions.
- **User Scoping**: SSE (`syncEmitter.emit('updated', userId, scope?)`), Web Push (`userId`), and reminders (`sendTo(userId, ...)`) are isolated per user.
- **SSE Scope** (`SyncScope`): `'entries'` (default wire event `'updated'`) or `'sources'`. `'sources'` triggers client `fetchIntegrations()` to update calendar metadata, colors, and import states. Entry mutations use `'entries'` to prevent recreating `Source` object references.

## The Sample Calendar (`Demo.seed` in `src/integrations/demo/Demo.ts`)
One fixture serves the dev account, every demo sandbox and every screenshot the site ships, so keep it calm: one entry per concept, the all-day lane empty around today, days inside 07:00–19:00 (what a capture holds).
- **Structured Availability Windows**: Shape the fixture's week using distinct, unnamed availability blocks (the color suffices; only Wednesday's work carries a place); recurring entries anchor to weekday rules or fixed dates to prevent drifting.
- **Dependency Links in Current Week**: App opens on `today−2…today+4`. Connectors must remain clear of intermediate chips and ribbon labels.
- **`credentials.seededFor` gates the refresh**: a seed edit shows up the next day, or immediately via the Demo integration's Re-import.
- **It speaks the user's language**: every string in the seed is a dictionary key, translated in the integration's own `i18n/<lang>.json` (loaded by the seed alone through `localizeSample`, never by the client that bundles the class, and checked by `npm run i18n:analyze` as a set of its own), including the five calendar names, which follow the language unless the user renamed the calendar. `credentials.language` says which: a sandbox takes the visitor's `Accept-Language` on arrival (`Sandbox.open`), and a switch in Settings sends it in a `PUT` and asks for a re-import (`integrations/demo/client/language.ts`). The seed stamp is day plus language, so either change rebuilds.

## Integrations & Sync Engine
- **Class Hierarchy & Registration**:
  - `Integration` base class (STI).
  - `registeredIntegrations` (`registerIntegrations.ts`): Imports all connectable classes in display order.
  - Class statics: `label`, `description`, `logo` (asset key for inline SVG), plus the facts the add dialog reads: `onePerUser`, `developmentOnly`, `discoversSources`. Instance getters: `canConnect`, `reimportable`.
  - Base constructor sets STI discriminator via `new.target.type`.
- **Capabilities** (`Integration.defaultCapabilities`): everything a provider can do, in one object. Entry features default to `true`, `createSources`/`deleteSources` to `false`. `capabilitiesIn(source)` turns off write actions on read-only sources; `availability` indicates provider support (Notion and Tempo disabled).
- **What Syncs See**: Engines query entries via `Integration.syncedEntries` (never bare `em.find`), excluding availability so remote sync passes and re-imports cannot delete local availability.
- **Source Management**: `POST /api/integrations/:id/sources` and `DELETE /api/sources/:id` check the capability, then call the optional `SyncEngine.createSource`/`deleteSource`. Renaming needs no capability: the name is Mitra's for every provider.
- **Integration Types**:
  - **CalDAV** (`integrations/caldav/CalDAV.ts`): Standard remote CalDAV sync engine.
  - **Google Calendar** (`integrations/google/GoogleCalendar.ts`, type `'google'`):
    - Extends `CalDAV`. Overrides `clientParameters()` for OAuth using stored `refreshToken` and env client credentials.
    - Credentials: `{ username: email, refreshToken }`. `toJSON` masks tokens; `merge` is a no-op.
    - Connect Flow (`GoogleOAuth.ts`): Backend PKCE exchange `/api/integrations/google/connect` -> callback -> redirect to `/?integration=<id>`.
    - Limitations: `capabilities.relations = false` (Google CalDAV drops `RELATED-TO` and `X-` properties).
  - **Mitra** (`integrations/mitra/MitraCalendar.ts`, type `'mitra'`): calendars stored in Mitra's own database, no provider.
    - `syncInterval = Infinity`; writes go straight to the database (`storesLocally` is true for every entry).
    - `fetchSources` returns the stored sources unchanged. Returning `[]` would make `getSources` delete them all, and Edit → Save reaches that path. `reimportSource` is a no-op for the same reason, and `reimportable` is false.
    - Constant uri `mitra://local`, so the `(userId, uri)` index allows one per user. New sources get `mitra://calendar/<id>` and are stamped `importedAt` on creation.
    - Participants are a record only: nothing delivers invitations or replies, and `addresses` stays empty, so a list started here has no organizer.
  - **Demo** (`integrations/demo/Demo.ts`, type `'demo'`): `MitraCalendar` plus the sample data (see §The Sample Calendar).
    - `developmentOnly`: offered only when `MITRA_DEV=true` (`meta.development`), and `POST /api/integrations` refuses it otherwise.
    - Seeds in `syncSource`, which the importer and the sync daemon both call, and rebuilds the entries (not the sources) when the day changes. Hence a finite 1h `syncInterval`.
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
  - Largest interval wins: presence cadence (10s online, 5min offline via `presence.ts`), provider `syncInterval` (Google/Notion = 60s, Demo = 1h, Mitra = `Infinity`), or flat 60s failure rest.
  - User coming online triggers immediate scoped sync. No manual "Sync Now" button or endpoint.
- **Vocabulary**: User-facing operations are named by intent, not mechanism:
  - **Connect**: Account auth and calendar discovery.
  - **Import**: Initial population of an enabled source (`Source.importing`).
  - **Sync**: Background incremental reconciliation (`Integration.sync`).
  - **Re-import**: Re-reading a calendar from the beginning (UI strings express intent, not local deletion).
  - **Internal terms**: 'fetch' is internal code-only; 'Refresh' is reserved for UI discovery reload.
- **Asynchronous Source Import** (`src/integrations/server/Importer.ts`):
  - **Non-blocking Apply**: `Integration.apply` persists credentials and enabled sources without reading entries, returning immediately with sources in `importing` state (`importedAt: null`).
  - **Importer Execution**: `Importer.start(em, userId, integrationId)` drains pending sources in background with forked EM. Emits `'sources'` SSE event after each pagination pass. Sync locks are held per pass, not across entire import.
  - **Import Completion**: `Source.importedAt` is set when `syncSource` completes without truncation/changes (capped at `Importer.maxPasses = 20`). Failures remain un-stamped for synchronizer retry. Mitra calendars are stamped on creation, since there's nothing to import.
  - **Re-import**: Discards entries, resets `Source.awaitImport()`, returns HTTP 202, and triggers background `Importer.start`.
- **CalDAV Protocols & Edge Cases**:
  - Multiget batch fallback: Tolerates 404s by falling back to individual fetches.
  - Date Writes (`CalDAV.writeDate`): Preserves authored form (TZID -> wall clock in VTIMEZONE; zoneless -> UTC). Series start shift shifts override `RECURRENCE-ID`s.
  - Concurrent Edits (412): Route all writes through `CalDAV.writeResource(entry, applyTo)`. Retries once on 412 with fresh ETag.
  - `updateEntry` mirrors changes (`exdates` too) onto the entry only after the PUT succeeds; null `exdates` means nothing to write.

## Bulk Migration (Move / Copy Entries Between Calendars)
- **3-Phase Architecture** (`src/features/sources/server/SourceMigration.ts`):
  1. **Copy**: Create all entries in target, collect old-uid -> new-uid map for target-minted IDs (e.g. Notion page IDs).
  2. **Repoint**: Rewrite `EntryRelation.targetUid` across batch using map; relations pointing outside batch remain untouched.
  3. **Delete**: Delete originals from origin (skipped if `keepOriginals: true`).
- **Ordering & Safety**: No cross-provider transaction. Copy failure rolls back copies and aborts before delete; delete failure leaves recoverable duplicates (never loss).
- **Copy vs Move** (`keepOriginals`): Skips phase 3 and mints fresh UIDs for copies. Phase 2 still runs, SCOPED: a move rewrites every row pointing at a departing UID; a copy rewrites only the copies' own rows, so a copied pair is a linked pair and the originals keep pointing at each other. A link whose target was not copied is left alone either way. Read-only origins permit copy but refuse move.
- **Concurrency Locks**: `Integration.exclusivelyAcross(ids, work)` sorts and deduplicates integration IDs to avoid deadlock.
- **Fidelity Preview** (`src/features/migration/MigrationPlan.ts`): Projected from `capabilitiesFor(target)` via `MigrationVerdict.assess` (shared with `IcsImport`). `MigrationBlocker` (recurrence, occurrence override pinning, participants, transparency, visibility, percentComplete) vs `MigrationLoss` (reminders, location, description, timeZone, allDay, cancelledStatus, type). Wire plan transmits only non-clean verdicts; `cleanCount = total - verdicts.length`.
- **Series Handling**: Refused if target lacks recurrence unless user explicitly selects `flatten: true` (writes `FLATTEN_HORIZON_DAYS = 366` single occurrences via `Occurrences.of(master)`).
- **Data Boundary**: `data.raw` never travels (strips origin sync data/ETag). Exclusions travel as `exdates` column via `exdatesOf`.
- **API Routes**: `POST /api/sources/:id/migrate/preview` and `POST /api/sources/:id/migrate` (`{ targetSourceId, entryIds?, keepOriginals?, flatten? }`). Returns 200 with `MigrationOutcome` report even on abort.
- **UI** (`DialogSourceMigration.ts`): Driven by `@lit/task` `Task` states (target picker -> series decision cards -> preview report -> outcome report).

## OS Calendar Integration (PWA Launches)
- **Manifest & Launch** (`scripts/indexHtml.ts`, `src/app/launch.ts`):
  - Registers `file_handlers` (`.ics`), `protocol_handlers` (`webcal` -> `/?subscribe=%s`), and `launch_handler: focus-existing`.
  - Cold protocol launches surface on both URL params and `launchQueue` (deduplicated on arrival). Window drag-and-drop intercepts `.ics` files to prevent browser file navigation.
  - `webcal` opens `DialogIntegration` prefilled without auto-connecting to keep external fetches user-initiated.
- **ICS File Import** (`src/features/migration/server/IcsImport.ts`, `POST /api/sources/:id/ics[/preview]`):
  - Reuses `SourceMigration` copy semantics: mints fresh UIDs, rewrites in-file `RELATED-TO` links, and rolls back on failure. Series overrides are blocked; exclusions persist in `exdates` (`data.raw` never persists).
  - Uses route-level `express.text` (25 MB) and client `postCalendar()` to avoid enlarging global JSON body limits.
  - UI: `DialogIcsImport` mirrors migration flow (target picker -> fidelity preview -> outcome; no series flattening).

## Sources & Entry Types
- **Type Declaration**: Sources declare supported types via `Source.entryTypes` (`'event'`, `'task'`). Availability is unlisted (supported everywhere; gated by provider `capabilities.availability`). Source identity is `uri` alone.
- **EntryType Value Object** (`src/features/entries/EntryType.ts`):
  - `EntryType.Event` (`'event'`), `EntryType.Task` (`'task'`), and `EntryType.Availability` (`'availability'`).
  - MikroORM custom type `EntryTypeType` (`src/features/entries/server/EntryTypeType.ts`).
  - Assigning `Entry.type` converts and strips unsupported fields (availability drops status, participants, reminders).
  - Format methods: `EntryType.format()` / `formatPlural()`.
- **Planning Surface** (`mitra-planning`): two sections, Overdue then Unscheduled, both from `EntryStore`.
  - `Entry.overdue`: open task whose `Entry.lastDay` (`due`, else schedule `end`) is before today. By day, not instant. Repeating tasks exempt (`partOfSeries`).
  - Unscheduled sorts by manual order, then due (dated first); start-less series yield only `currentOccurrence`. Due tasks show with flag.
  - Unscheduled is also the drop target clearing an entry's dates, so it keeps `flex: 1`; Overdue caps at half the panel.
  - `Planning.pending` feeds the sidebar tab badge. Only one-off tasks can be unscheduled (`Entry.unschedulable`, shared by the editor's ✕ and the drop on Unscheduled): a series' dates identify its occurrences.
  - Overdue excludes the drag preview (`EntryStore.previewing`): a ghost with a new past date is still overdue, and nothing is dropped into this list. The ghost belongs to the grid; the source row stays, faded.
  - Scheduling and unscheduling share `EntryDragController.move`.
  - Drawer tabs: `src/design/Tabs.ts` (declarative, scroll-driven). The panel strip always scrolls LTR (in RTL its panels are reversed with `order: calc(-1 * sibling-index())`): Chromium puts a `view()` timeline one panel off in a scroller whose origin is its inline end (RTL or `row-reverse`), which faded the shown panel out.
  - Chip height tiers: roomy-first, cramped as exception via `--density`.
  - **Manual Task Order**: `Entry.rank` (`EntryRank`, a fractional key, null until placed) is Mitra's own and never synced. The client places tasks (`EntryStore.reorder`) and sends only the changed ranks to `PUT /entries/ranks`. A series ranks through its master (`Entry.masterId`). Paths that re-create an entry must carry `rank`.
  - **Reorder Gesture**: a stock `@3mo/reorderability` controller on the Unscheduled list. Leaving the list `abandon()`s the reorder and hands the pointer to `EntryDragController.beginExternal(..., { held: true })`.
- **Due Dates & Estimates**:
  - Vocabulary (UI and docs, one word per idea): the **schedule** (`start`/`end`; a task is scheduled or unscheduled), the **constraints** (**due date** and **estimate**, never "deadline" or "duration"), and **planning**, scheduling unscheduled tasks to fit their constraints (the Planning tab). A start without an end is a **moment**.
  - Task temporal model: `start`/`end` (schedule), `due` (due date), `estimate` (minutes). End and estimate are mutually exclusive: `start ? estimate === null : end === null`. `scheduleAt` turns estimate into `end`; `unschedule` converts duration back to `estimate`. Drag gestures only move schedule, never `due`.
  - Moments: Scheduled task without `end` (`Entry.point`) renders single segment moving without duration; `MINIMUM_DURATION_MINUTES` applies only once `end` exists.
  - Value type parity: `setAllDay` converts `due` along with schedule (day ↔ 17:00 wall-clock) to satisfy VTODO `DTSTART`/`DUE` type-matching requirement.
  - CalDAV wire mapping (`taskTimesFrom`/`writeTaskTimes`): writes `DTSTART`, `ESTIMATED-DURATION` (ical.js duration) for length/estimate, and `DUE` for deadlines. Never write `DURATION` on a `VTODO` (RFC 5545 defines it as computing `DUE`). Legacy blocks without `ESTIMATED-DURATION` treat `DUE` as `end`.
  - Provider capabilities: `due` and `estimate` (Notion supports neither). Mutations 400 if target cannot store `due`; unsupported `estimate` drops silently.
  - Recurring start-less tasks: Anchored on `due` (`Occurrences.of`). In UI (`expandedOccurrences`), only `currentOccurrence` (first upcoming due in viewer zone) is emitted. Scheduling one occurrence detaches it implicitly as `'this'` (`EntryStore.schedulesOccurrence`).
  - Editor moments (`EntryDetailsWhen`): one field per row (start, end or unscheduled estimate, due), `mitra-date-time-field` or all-day `mitra-date-field`, then zone and repeat. Each row's All day toggle (pressed while all-day) switches entry-wide `setAllDay`, shown only on the row in use. The end gets the start's day as `impliedDate`. Task ✕: start unschedules, end makes a moment. Placeholders use noun labels, never verbs.
- **Window Query** (`src/features/entries/server/entryWindow.ts`): `GET /entries` also carries rows no window contains: undated (`start: null`) and open tasks due before the window start. Route and test import it; never restate the filter. Client narrows via `Entry.overdue`.

## Calendar Views & Layout Engine
- **Weeks Follow the Locale**: `DateTime.weekStart` starts on the locale's first day (Sunday `en-US`, Saturday `fa`, Monday `de`). Every grid takes the week from there (`CalendarDatesController.sampleWeek`, `CalendarMonth.firstColumn`, the timeline's week marks, the repeat weekdays), never from `dayOfWeek === 1`, and a locale switch generates the buffers again. The server resolves a locale too (`en-US`), so the sample calendar anchors on Monday itself.
- **Layout Architecture**:
  - View Components: `Days` (`mitra-days`, week), `Weeks` (`mitra-weeks`, month), `Months` (`mitra-months`, year), `Timeline` (`mitra-timeline`, task planning band).
  - `EntrySegments` Engine:
    - `EntrySegments.for(entry)`: Memoized per-day segments with `previous`/`next` links.
    - `timedOn(day)`: Clustered side-by-side columns.
    - `runsIn(from, to, accept)`: Representative segments touching window via per-cohort `segmentsByDay` index.
    - `monthSlots` / `allDaySlots` / `monthWeek(week)`: Unbounded greedy lane packing (no slot caps; overflow clips behind bottom fade).
    - `static laneRank(entry)` / `laneOrder(a, b)`: Lane ordering for month and year packing; ties fall to the heading, never arrival order.
  - Self-Placement: Views map dates to grid columns via `Map<dayValue, index>`.
  - Hot-Loop Date Math: Cache `.dayValue` (`YYYYMMDD` integer) or `epochMilliseconds` in tight loops.
- **Gestures & Controllers**:
  - `EntryDragController`: Container-level controller for create, move (delta translation), and resize (edge drag). Resize handles: 0.25rem strips (`resize: 'block' | 'inline'`).
    - Cells are chosen by *nearness*, so every point would snap into one. `places()` gates that on the grid's box minus the sidebar's, which overlays the grid below 800px. A release with nothing built reverts via `adoptSpan(drag.before)`.
    - A move carries the offset from `drag.anchor` (the grabbed point of the entry) to the pointer. A chip dragged in from the planning list was never grabbed on a day, so its anchor is the entry's own start. Hit-testing the sidebar's coordinates would offset the drop by whatever day the clamp picked.
    - `EntryStore.shownPreview` drops the ghost when it `spanEquals` the dragged entry: a drag moves nothing else, and comparing by `editEquals` doubled the row over the unschedule target, where `unschedule()` also clears reminders.
    - `apply` skips repainting when the built span equals the shown preview (`Entry.spanEquals` + `EntryStore.previewing`). Without it every frame repainted every chip, so never call `setPreview` with an unchanged span.
  - Drafts: Single active local draft in `EntryStore.draft` (`id = 0`, `persisted = false`). Backend assigns final IDs.
  - `CalendarScrollController`: Date-anchored scrolling across views. Snapping gated on device type (notched wheel vs continuous touch/trackpad). A navigation arrives on the cross axis too (`geometry.arrival`): the week view centers today's now line, any other day its middle. A view tells a navigation from a scroll echo by identity: a scroll hands back the very date it read, so a same-day navigation (Today) still arrives.
  - `DensityController`: Shared zoom gesture (Ctrl+wheel, wheel over rail, 2-finger pinch). Subclasses override `settled()` to dispatch synthetic scroll on inner scroller elements.
  - `TimeZoneLaneController`: Alternative zones fold; anchor zone never folds. Clamps cells (`max-inline-size: var(--zone-width)`). Rail inline drag with `touch-action: pan-y`.
  - Week All-Day Lane: Explicit row tracks (`grid-template-rows: repeat(var(--slots), var(--slot-height))`), never auto-flow.
- **Entry Chip Heading** (`EventSegment.ts`): two layouts picked by `--inline`, declared once. Triggers: no meta row (`[data-meta]` absent), or no height for one (`@container (max-height: 2rem)`). Set the switch; never re-declare the collapsed layout. `--inline` is a space toggle (empty = on, `initial` = off) read as `--_x: var(--inline) <on>; prop: var(--_x, <off>)`, since CSS `if()` is Chromium-only.
  - When-line comes from `DateTimeRange.format()` (`Intl.formatRange`), which drops the shared parts and puts the day before the times. Never hand-assemble start/separator/end.
  - `.range` and `.point` both render; `--inline` picks. A one-line chip shows only the start.
  - `dated` adds the day, for lists drawn away from the grid. Off wherever a column already answers "when".
- **Month View** (`mitra-weeks`):
  - Strip of week rows with subgrid column alignment and continuous CSS density scaling (`--_month-density`).
  - Row Structure: Numerals track + `.entries` overlay (unbounded lanes, `overflow: hidden` + gradient bottom fade). Routines ribbon rendered in track after last bar.
  - Stacking Context: Explicit `z-index: 2` on `.entries` to preserve stacking order over relations connectors (z: 1 resting, z: 3 hover).
  - Caching & Rendering: Per-week layout memo (`weekLayouts` keyed on routines cohort) with `guard()`ed week templates.
  - Week-Number Rail: Leading track (`--_week-rail-width`) in header and canvas. A row is labelled by the ISO week of its Thursday, as it starts on the locale's first day. Click dispatches navigation and view switch. `[data-week-numbers]` collapses rail when undefined. Numeral is block-sticky inside cell.
  - Zoom Engine (`WeeksDensityController`): Bounds 2–9 weeks (min row 4.5rem). Multiplies ideal height (`--month-zoom`). `[data-zooming]` enables granular tracking during gestures; settles via whole-row quantization glide before returning authority to CSS integer fitting.
- **Yearly View** (`mitra-months`):
  - Horizontal strip of `mitra-day` mini-month cells.
  - Month metadata from `CalendarDatesController.months`.
  - CSS subgrid overlay for lanes; overflow clips.
  - Zoom via `MonthsDensityController` (extends `DensityController`). `overflow-anchor: none` on host scroller.
- **Timeline View** (`mitra-timeline`):
  - Open scheduled tasks only, 1 row per task, sorted chronologically. Virtualized based on plan, not scroll position.
  - Arrival placement: `CalendarScrollGeometry.arrival`.
  - Routines show only due occurrences (today + upcoming window).
  - Bar text renders outside bar. Transparent canvas.
  - Sticky `.jump` buttons on viewport edges when task bar scrolls out of view.
  - Zoom via `TimelineDensityController`.
- **Table View** (`mitra-table`, `src/features/calendar/client/Table.ts`):
  - Lists a `TableWindow` counted from today (presets or a custom range; `HideDoneTasksSetting` does not apply), chosen in the When column's menu. No paging: the table has no `PageCalendar.period`. Title cell embeds `mitra-entry-segment` for color, status, and popovers.
  - The unbounded window (`GET /entries/all`) lists a series once, as its start occurrence (`seriesStarts`), so `TableRow.scope` is `'all'` there and batch actions go through the tested occurrence routes.
  - CSS grid `div[role=grid]` with `subgrid` rows (never `<table>`: Lit template parser foster-parents elements out of `<tbody>`, and Chromium drops `subgrid` under `content-visibility: auto`). Virtualization monitors `.cells`.
  - Header row itself is `position: sticky` (never individual cells). Trailing `.actions` track is sticky to the end. Only sticky header cells take a `z-index`, so resizers can straddle column boundaries.
  - Columns fit their content (`max-content`). A hidden `.anchor` row holds each column's widest content so tracks stay put under virtualization; the title chip has no intrinsic width, so its widest heading stands in.
  - Resize line is drawn inside the handle, offset by the handle's start taken at press. Never `position: fixed`: `.calendar`'s `contain: layout` shifts it.
  - Cells reuse editor components (`mitra-participant-faces`, `mitra-entry-link`, `mitra-map-link`), never copies. A row pending an editor open (`EntryEditorIntent.holds`) keeps its cells.
  - Batch mutations run entries in parallel, but series occurrences sequentially (scope `'this'`, sharing master exclusions).
  - The editor opens inside the title cell, so the grid would take Home, End and the arrows typed into its fields as cursor moves; `TableRowComponent` stops field-originated keys from reaching it.

## Routing & URL State
- **One Route** (`PageCalendar`, `@route('/:view', '/')`): View is the path (`/week`), active overlays and filters are query parameters (`?date=`, `?selected=`, `?settings=`). Canonicalizes `/` to `/{defaultView}`. Unrecognized parameters fallback gracefully.
- **`CalendarLocation`** (`src/features/calendar/client/CalendarLocation.ts`): Value object parsing and serializing URL navigation state. Initialized on page boot so initial render and fetch match restored view and date. Today is omitted to prevent link date pinning.
- **Single Writer, Derive Don't Mirror**: `PageCalendar` is the sole URL writer. It overrides `get url()` to derive from live state and never assigns `parameters`; an inbound `parameters` change is purely the router's arrival signal, handled by an idempotent `restore()` of the address bar (`CalendarLocation.of(location)`), never of `parameters` themselves: the router re-hands the path parameters the page was first navigated with, so reading `view` from them reverted an in-app view switch on the next app render. Components publish state the page reads (`EntryEditorIntent.target`, `SettingsParameters.pageChange`).
- **Replace, Never Push**: All writes funnel through the `updateUrl()` override (the framework's own `parameters` hook lands there too) into `UrlSyncController` (`src/infrastructure/routing/`), which owns the timing policy: `history.replaceState`, 100ms trailing debounce, flushed on `pagehide`/`visibilitychange`. Its host is typed `PageCalendar` (as `EntryFetcherController`'s is), so it reads `host.url` and self-schedules from `hostUpdated()`: no callbacks, no generics, nothing for the page to call. A write is skipped outright when the URL has not moved, so an unrelated re-render (an entry saved, a drag frame) neither writes nor postpones a write already due. Pushing would bury the arrival page under an entry per scroll flick, and the framework's `setUrl` wraps pushes in a document-level view transition that fights `transitionCalendar`. Collapses to a declared `historyStrategy` once @a11d/lit-application ships one (drafted upstream).
- **Device Preferences**: Zoom, sidebar open state/tab, connectors, timezone folding, and the table's window live in `localStorage`, excluded from shared URLs.
- **Stale Targets**: `?selected=` restores via `EntryEditorIntent.requestOpen`. Unmatched intents settle and clear from the URL on next write.
- **SPA Fallback**: The server catch-all must stay `res.sendFile('index.html', { root })`. Without `root`, send dotfile-checks every segment of the absolute path and 404s deep links whenever the checkout lives under a dotted directory (e.g. a `.claude` worktree).

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
  - Page header buttons (Create, `‹ Today ›`) are the commands themselves (`PageCalendar.commandButton`): titled with the command's heading and keys, acting through `dispatch()`. `PageCalendar.period` (`CalendarPeriod`) is what the arrows step by and the heading names; the table has none.
  - Non-Command Actions: Pointer gestures and editor-specific shortcuts stay in their own components.
- **Command Palette** (`mitra-command-palette`):
  - Pure view. Filters via `commandMatches` → `termsMatch` (`src/features/commands/termsMatch.ts`, the app's ONE search rule, also the settings dialog's; kept out of `Command.ts` so searching doesn't drag in the app root).
  - Navigation: Native `<dialog closedby="any">` around an inline `mitra-combobox` (its `dismiss` closes the dialog). Triggered by bare `/`, `Ctrl+P`, or `Ctrl+K`.
  - Search: Unwindowed backend `GET /entries/search?q=` (SQL LIKE, limit 20, 200ms debounce).
  - Selection: Emits `navigate` and requests editor open via `EntryEditorIntent.requestOpen(id)`.
  - Series hits: the search filter is `entrySearch` (route and test share it); `seriesNear` turns each master into its occurrence in progress or next to come (else its last), under the `master__ms` id the window mints. Never request a master id from a pick: any rendered occurrence matches it, and one in the view being left takes the intent before navigation lands.
- **Editor Intent** (`src/features/entries/client/EntryEditorIntent.ts`):
  - Holds transient view intent for target editor (`openDraft(draft)` or `requestOpen(id)`).
  - Anchored via `EntryEditorAnchor` on hosting surfaces (chips, availability segments), which declare `entryColors` (`entryColors.css.ts`) and open run-start segments (`!hasPrevious`). `settle(entries)` clears unmatched intents.
  - Surface transitions (chip ↔ availability type changes) and span edits defer re-requesting the entry until post-render to prevent departing hosts from intercepting the intent.
  - A span edit also dispatches `reveal` with its entry, so the reopened editor has a segment on screen: the view's `CalendarScrollController` navigates to a scheduled entry it doesn't show, and `PageCalendar` sends an unscheduled one to the Planning tab (`Sidebar.showPlanning` opens the sidebar and scrolls to the row).
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
  - Entry points: Sidebar footer, command palette, and `Ctrl/⌘+,` chord routed through `PageCalendar.openSettings()` to sync active page to URL.
  - `SettingsParameters` accepts `page` (validated via `DialogSettings.pageOf`) and `pageChange` callback.

## Recurrence & Routines (RFC 5545)
- **Recurrence Model**:
  - Single master entry with `RRULE` in `Entry.recurrence` (`Recurrence` value object, `src/features/recurrence/Recurrence.ts`).
  - Occurrences expanded on read via `expandRecurrence`.
  - Edited exceptions sync as individual rows with `RECURRENCE-ID` and `recurrenceMasterId`.
  - Edits currently apply series-wide via dedicated recurrence API routes.
  - A scoped edit may ALSO change the calendar, and the two compose (`editOccurrence`'s `movingTo`): 'this' detaches the occurrence INTO the target, 'following' starts the continuation there (the old half stays), 'all' re-creates the whole series there (same uid, rule and exclusions) and deletes it here, create-first. The client must send `sourceId` with the scoped PUT; without it the picker changed and nothing moved.
- **Routines (Density Collapse)**:
  - Dense cohorts collapse into compact ribbons in month/year views.
  - Layer above recurrence: entries sharing appearance (`sourceId`, `heading`) pool into one routine (series, overrides, detached check-offs, all-day placeholders). Blank headings fall back to per-master.
  - Gate: `min(member rule strideDays, median observed day gap) < rowUnitDays * slack` with >= 4 instances in window. Slack: week = 1.0 (weekly stays bars), month = 1.25 (collapses ~5-week cadences).
  - Rendering: 1 ribbon mark per active day (never spanning bars). Modifies `mitra-entry-segment` with `.routine`.

## Reminders & Notifications (Web Push, RFC 8030)
- **Anchor Semantics**:
  - `Entry.reminders` count minutes before `Entry.reminderAnchor` (`start`, falling back to `due` for unscheduled tasks; UI gates on `reminderAnchor`). `unschedule()` clears reminders unless a due remains to anchor them; closed tasks never fire.
  - CalDAV TRIGGER `RELATED`: `START` by default, `END` for unscheduled tasks, relative to `DUE` (`CalDAV.reminderAnchorOf`). Reads and writes share anchor mapping to preserve unmanaged alarms.
  - Default reminders tracked in a module `WeakMap` until user explicitly customizes via `setReminders`.
- **Payload & Rendering** (`ReminderNotification`):
  - Body shows entry time (never live countdown; delegated to OS `timestamp` to avoid burning silent-push budget).
  - Server renders per subscription (`ReminderNotification.for`) in its `language` and `timeZone`, with the regular keys via `localizeIn` (`i18n/dictionaries.ts`; the server has no current language, so no `t()`). The worker only shows the payload.
  - Max 2 buttons (Chrome limit): Tasks get Done + Snooze; events get Snooze (body tap navigates to `/?date=&selected=`).
  - "Done" posts `POST /entries/:id/complete` (detaches occurrence like a 'this' edit; falls back to opening editor on error).
- **Delivery Guarantees**:
  - Push headers set `TTL` (`anchor + 5 min` grace) and `urgency: 'high'` (bypasses Android Doze, prevents stale queue delivery).
  - `icon` sent to Android only (prevents origin letter avatar on Android without duplicating image on Windows).
- **Scheduler Engine** (`ReminderScheduler`):
  - Ticks claim `(watermark, now + interval]` window and schedule exact timers (`setTimeout`).
  - Persistent watermark (`reminder.watermark` state key) advances to `now` for crash recovery; in-memory `dispatched` map deduplicates.
  - Query bounds: `start > watermark - ZONE_SLACK` (or `due` for unscheduled tasks).
  - Observer time zone: `NotificationSubscription.timeZone` / `lastSeenAt` tracked per device to resolve floating wall-clock times (`Entry.reminderAnchorInstant`).
- **Device Management Surface**:
  - Subscriptions listed under Settings → Notifications via `NotificationsSetting.details` rendering `<mitra-notification-devices>`.
  - `NotificationSubscription.register` updates `deviceFacts()` while preserving user-assigned `name`; `keys` masked via `withheld()`.
  - The page registers again on a language change. A rotated subscription (`previousEndpoint`) inherits `name` and `language` (`succeed`), which the worker cannot read.

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
  - A dependency into the neighbouring column drops from the source's bottom to the target's top in a vertical S-curve when the two sit clear of each other (`TALL_RANK_DELTA`, and on the timed grid `TALL_GAP_MINUTES` of free time, else its box inverts). Any other dependency into the neighbouring column, and a draft aimed closer than two stubs and an arrowhead (or behind), is a `bend`: two arcs of one radius (`BEND_RADIUS`) joined by their shared tangent, so every turn reads alike at any distance. A stretched mask cannot hold a radius, so the bend is pure CSS geometry: the piece is a size container and its three inks place themselves with container units and trigonometry (lengths divide as `tan(atan2(a, b))`). It is emitted for both sides and the wrong twin's box inverts to zero width, which a container query hides (its arrowhead too: a container's pseudo-elements query it). Its arcs are a radial-gradient ring intersected with a conic sector: an `exclude`d padding ring under an `intersect` leaves a faint full circle in Chrome.
  - Realm separation: Lane layer draws lane<->lane edges; canvas layer draws timed<->timed and cross-realm edges (via scroll-driven CSS animation timeline / offset correction).

## Availability
- **Model & Local Storage**:
  - `EntryType.Availability` defines repeating background windows adopting calendar color; defaults to free (`Entry.showAs`).
  - Stored locally (`Integration.storesLocally` is `true`); writes bypass remote engines and cascade on calendar deletion.
- **Rendering & View Filtering** (`src/features/availability/client/`):
  - Filtered from standard layouts via `Availability.outside()` (never enters `EntrySegments` or `Routines`). Rendered in Week view as `<mitra-availability-segment>`.
  - Layering: `.window` (base, opens editor via `Drag.availability`), chips (z-index 2+), `.labels` (z-index 3 at `Availability.labelPositions`). Hour lines (`.overlays .hour`) remain click-through.
  - Global `HideAvailabilitySetting` toggles visibility across all calendars.
- **Fences & Series Intent**:
  - Excluded from search, relations, participants, reminders, and all-day lanes. Migration requires `capabilities.availability`.
  - `EntryEditorIntent.shouldOpen` matches occurrences only, never series masters (avoids closing editor on post-save occurrence replacement).
- **External Publishing & CalDAV**:
  - Local writes dispatch to `SyncEngine.publishAvailability(entry)` without locking; reconciled on calendar toggle, disconnect, and full sync.
  - CalDAV mirrors busy availability as `VEVENT` series prefixed `mitra-availability-<uid>` (free availability is never exported). Failed writes retry on subsequent sync.

## Links
- **Derived, never stored**: an entry's links are a reading of its description (`MarkdownLinks.of`, `src/design/MarkdownLinks.ts`) and its location (`MarkdownLinks.sole`: the text is one link and nothing else), as `Entry.checklist` is of the description. The editor's Links row (`EventDetails.hyperlinksTemplate`, no component of its own) only reads: a link is added and removed where it is written. No column, no capability, no sync change. The row's `li` is always rendered, `hidden` while empty: a row inserted before the description made lit rebuild the textarea being typed in. CalDAV's `URL`/`ATTACH`/`CONFERENCE`/`LINK` are translation targets for a later read-only phase, never Mitra's model.
- **One linkifier**: `MarkdownLinks.marked` (a `Marked` instance plus the bare `scheme://` extension) renders descriptions AND reads their links, so the row and the text cannot disagree. Never `marked.use()`: `NotionMarkdown` lexes with the global instance. A scheme is a link only as a whole word, read off the preceding token, since an inline `start()` sees no further back than its cut. `MarkdownLinks.allows` refuses `javascript:`, `data:`, `file:` and the like everywhere.
- **`mitra-link`** (`src/design/Link.ts`) owns how a link looks: the renderer hands it marked's own escaped anchor, renamed. An empty one (a bare address) names its destination: a web page by host and path, a meeting call as "Join <service>" and an app's link by its app (an Obsidian note by its name), from the component's own `meetings` and `apps` tables. A web page cannot learn which app owns a scheme, so that table is the only source; every app link shares one glyph. `plain` (text colour, accent on hover) in the editor's Links and location rows. A location that is a link shows as that link, edited by a click beside it, and gets no map.

## Sidebar & Navigation
- **Source Icon**: `<mitra-source-icon>` (`src/features/sources/client/SourceIcon.ts`) renders source/provider glyphs reading color, importing state, and entry types directly from the bound `.source` (re-rendered when integration refetches mint fresh instances). Never mirror `Source` fields into separate component properties.
- **Sidebar Grid**: Single CSS grid (`.integrations`) aligns all source rows, headings, and gutters across providers. Its `--sidebar-gap` is both the column gap and (the first column being zero-wide) a row's content inset. The Planning tab's heading takes it too, so every heading in the sidebar rides one column. Anything listing sources elsewhere (the migration dialog) reproduces that relationship: heading text starts where the row icons do.
- **Gutter**: Scroller uses `scrollbar-gutter: stable` to prevent layout shifts.
- **Primary Source**: Always resolve via `getPrimarySource()` (default source or first visible), never raw ID.
- **Ordering**: `Source.order` column (nullable integer).
- **Row Actions**: Source visibility eye toggle is the trailing action.

## Website (`website/`)
- **One Astro project**: the homepage (`src/pages/index.astro`) plus Starlight rendering `../docs`, linked in by `prepare.mjs` (everything it writes is gitignored). The host lives once in `site.mjs`.
- **The look is emitted, never restated**: `tools/tokens.mjs` evaluates `src/design`'s lit fragments in Node, so `contrastColorOf()` feature-detects in CSS rather than with `CSS.supports`.
- **Raw HTML in Markdown never becomes rehype elements**: rewrite it in remark, on the text (`remarkDocsAssets`). Clear `website/.astro` and `node_modules/.astro` after changing a plugin.
- **Captures** (`npm run screenshots`; `npm run release` recaptures and commits them): settle on a stable, non-zero count of `mitra-entry-segment, mitra-table-row`, never a delay; drive surfaces with real input and park the pointer afterwards. Frozen at one Thursday (2026-10-01 10:20, Berlin, `en-150`: European English, so Monday weeks and 24-hour times belong to no country; stored as the full tag, since a bare `en` takes the browser's region) under reduced motion, so a rerun rewrites only what changed; availability is hidden except in its guide. The harness (`scripts/capture.ts`: staging, CDP, `stage()`, `screenshot()`, the find/open/crop helpers, `sampleLanguage()`) serves the docs' stills (`screenshots.ts`, overwritten every run, lossless WebP) and a release's captures (§Releases). The docs' and homepage's stills follow the reader's language: English's are committed in `assets/screenshots/`, and `npm run screenshots -- --language de` shoots another language's into the gitignored `assets/screenshots/de/`, which the website's CI does for every language before it builds, one job per language side by side (each cached on the English captures and the scenes: those change with the app's look, so a wording change alone reaches a language's captures at the next look), since a set per language would grow the history several times over. So a scene finds what it clicks by the dictionaries (`appText()`, `sampleText()`), never by English text. The site shows a language's still where there is one, English's where not. `open()` sets theme and language through storage: a `?lang=` parameter is gone by the reload.
- **Films** (`scripts/film.ts`): a scene steps Chrome's virtual clock one frame at a time (`Emulation.setVirtualTimePolicy` with `advance`; the policy that waits for fetches never moves, the SSE stream being a fetch that never ends) between real pointer events, with the cursor drawn into the page, so a film is the same on any machine. A frame is two half-steps: draw the pointer, send its event, advance (an input is acknowledged only once Chrome drew), then dirty an invisible element, request the screenshot, advance again (requested before the input's half, the screenshot shows the ghost trailing the pointer; on a standing clock either hangs forever). Endless animations are paused at time zero. `encodeFilm()` keeps the file unless a frame moved more than raster noise; CRF 16 (20 fringed the white arrow); ffmpeg on PATH. The cursor is the Windows arrow, black on light, white on dark, one soft black shadow, no press disc. `MOTION_TRACE=1 CONSOLA_LEVEL=4` logs every step.
- **Crawlers**: website `robots.txt` points to Starlight sitemap; app `robots.txt` disallows all (prevents demo sandbox creation and crawler indexing). `starlight-llms-txt` provides `/llms.txt` and `/llms-full.txt`.
- **Longhands only with `animation-timeline`**: the minifier folds `animation:` plus `animation-timeline` into one shorthand Chrome rejects, so the animation silently never runs.
- **Copy** (site, `docs/`, README): plain sentences, no em or en dashes (a heading's dash also breaks its anchor), no emoji bullets. Quote a frontmatter `description` containing a colon.
- **Translations** (`languages` in `website/site.mjs`; English at the root, the others under `/de/…`): a page's translation is the file beside it, the language before the extension (`docs/views/week.de.md`, `releases/0.6/README.de.md`), complete or absent, its links and captures written as in the English file. A translation keeps the English headings, their number, levels and order: each takes the anchor of the English heading in its place (`rehypeEnglishAnchors`, `Release.anchorOf`), so `page#section` is one address in every language, and a release's sections take their kinds by position (`ReleaseNotes.translation`). It leaves the date to the English file. When you change an English page or release notes, change its translations too, or the page shows an outdated notice from the git dates; translate a release's notes before its tag. An untranslated page shows the English text under the prefix with a notice, and points search engines at the English page (canonical, no `hreflang`, out of the sitemap). The site's own words, the homepage's included (`components/Home.astro`, rendered at `/` and `/de/`), are `t()` keys in `website/i18n/<lang>.json` (`website/src/i18n.ts`, which reads the dictionaries itself: @3mo/localization needs a bundler), over the app's dictionaries for words the app already has; `npm run i18n:analyze` checks them, counts the pages each language lacks (`--pages` lists them) and fails on a translation whose headings differ. The release pages and the feed live under `pages/[...language]/`. The build copies the translations beside every release's notes, and the About dialog reads the app's language there, linking the website in it. A release's captures stay English, as shipped; the docs' and homepage's are shot per language (§Captures). The name is `t('Mitra')` wherever the site writes it (میترا in Persian), and the site stacks the app's fonts (Inter, then Vazirmatn, each fetched only for its script).

## Releases (`releases/`)
- **One folder per minor**: `releases/<minor>/README.md` (frontmatter `title`, and `date` once shipped; an intro; a `##` per highlight, `Upgrading` being the one heading that is not one) beside its captures. A highlight shows its capture as a `<picture>` (a `prefers-color-scheme: dark` source over `name-light.webp`, which GitHub switches by its reader's theme); a film is the picture of its first frame (written beside its `.mp4` as its poster), since GitHub plays no video from a repository. The site and the app read the name out of it, play the `.mp4` when there is one, and switch takes by their own chosen theme, which a picture's media query cannot see, and its `Docs: [page](../../docs/page.md)` line becomes the icon beside its heading. `## Contributors` is a list, `- [@login](https://github.com/login): what they did` or a bare name: the cut adds every commit author since the previous tag (a login when the name or noreply address is one), hand-written lines stay, and the page draws GitHub's avatars. How a release reads is one stylesheet, `src/features/about/releaseNotes.css.ts` (classes under `.release-notes`; sizes as `--release-*`), worn by the app's `mitra-release-notes` and emitted by `tokens.mjs` as the site's `generated/release.css`; each surface keeps its own markup and hero. The list and the page pair the numeral, the mark, the title and the intro by `view-transition-name` (`website/src/styles/releases.css`, cross-document, CSS only). The app's About dialog renders the same notes: the build copies every release's README into `dist/releases/<minor>/` with the captures of the releases it is (a tag's minor, plus the draft past a tag; `scripts/releaseAssets.ts`), `GET /api/meta/releases` hands them over with the changelog (`server/changelog.ts`), and an older release reads as text.
- **Captures are made once**: `npm run captures:release <minor> [name …] [--force]` shoots the release's own scenes (`releases/<minor>/scenes.ts`, registered like tests: `still(name, options?, fn)` and `film(…)` from `scripts/scenes.ts`) in both themes and borrows any other name from `assets/screenshots/`. What the folder holds stays, since it shows the release as it shipped, and the run warns past 2 MB of captures, since the image carries its own release's. A scene says how to get there and what to keep; theme, language (`{ language: 'fa' }` rewrites the sample calendar too), clock and files are the runner's. A release may open with a letter, `## Why Mitra` (`ReleaseNotes.foreword`), signed by a last line that is the author's GitHub link alone.
- **Nothing is written twice**: the rest of a release is its `CHANGELOG.md` section; patches (`x.y.z`) list under their minor and get no notes. `npm run release x.y.0` refuses to tag without a titled README (it scaffolds one and stops), completes the captures on the build the screenshots just made, and dates the notes (a pre-release stays undated).
- **One model, several readers**: `ReleaseNotes.parse()` and `Release.list()` (`src/features/about/`, pure) serve the app, the scripts and the website (`website/src/releases.ts` extends `Release` with files and routes): the oldest undated README is the release in development (taking the commits past the last tag), any newer undated one `planned`, the newest dated one `latest`; the state is derived from dates and order, never written down. Beside the numeral goes which release it is to the reader (`Release.channel`: Latest, Next, the `:latest` and `:dev` images), where the date goes its day, "in progress" (with the app's in-progress dial on the site) or "planned". Readers: `/releases/`, `/releases/<minor>/` (captures copied to `public/releases/`, served immutable), `/releases.xml`, the GitHub body (`scripts/releaseBody.ts`), and the app's About dialog. The site and the app read fixes and performance as one category, Improvements (`Release.categories`), and the site counts tests, CI and build, and chores instead of listing them.

## Build, Test & CI/CD
- **Runtime**: Node 26 (`.nvmrc`, read by CI; `engines` and the Dockerfile match it). Temporal comes from `scripts/injectTemporalPolyfill.ts` wherever the native one is missing or partial.
- **Type Checking**: `npm run typecheck` (TypeScript 7, the native `tsc`), the one entry for `npm start`, CI and agents; esbuild does not typecheck. typescript-eslint still needs TypeScript 6's JS API, so `typescript` aliases `@typescript/typescript6` and 7 installs as `typescript7`; the script calls its `bin/tsc` by path, since `@typescript/old` (6) also claims `tsc`.
- **Linting**: `npm run lint` (ESLint 10, `@a11d/eslint-config` 2, type-checked: every linted file belongs to `tsconfig.json`, `scripts/` and `releases/` included). Enforces tabs, single quotes, no semicolons, a trailing newline (`eol-last`), `max-lines` 1000 per file (split like `CalDAV.<topic>.test.ts`), `no-console` (except `warn`/`error`).
- **Tests**: `npm test` -> `scripts/test.ts` (clears `out_test/`, bundles `src/**/*.test.ts`, runs `node:test`).
- **Development**: `npm start` -> `scripts/dev.ts` (`npm run typecheck -- --watch` + esbuild watch).
- **Production Build**: `npm run build` -> `scripts/build.ts`. Shared esbuild config in `scripts/esbuild.ts`. Requires `data/` directory.
- **PWA Icons & Badges** (`scripts/indexHtml.ts`):
  - **Maskable Icon**: Android requires a dedicated `purpose: "maskable"` (never `"any maskable"`, which creates a white plate). `adaptiveLayer()` scales the mark to 50% over `themeColor` to fit Android's 66% circular mask (tighter than the 80% spec).
  - **Monochrome & Badge**: Single-color on transparency (`assets/mitra-monochrome.svg`), shipped only as `notification-badge.png` (Android draws the badge from its alpha alone). Never as a `purpose: monochrome` manifest icon: Chrome's WebAPK minter ignores that purpose, and Edge on Windows paints it black into the installed app's toast header.
  - **Notification pictures are Android-only** (`serviceWorker.ts`): Chrome for Android always shows a large icon at the notification's end (a letter avatar of the origin when none is sent) and Wear OS draws it as the avatar with the small icon on top, so the `icon` is the colored mark there. Windows and macOS ignore `badge`, and their toast header shows the icon the OS registered at install time from the manifest's `purpose: any` icons, which no notification option changes.
- **Compression** (`src/infrastructure/http/compression.ts`):
  - **Static Precompression**: `precompressed(dist)` middleware serves build-time `.br` (Brotli quality 11) / `.gz` (Gzip level 9) assets generated by `scripts/precompress.ts`. Falls back to runtime/static files if precompressed sibling is stale or missing.
  - **Dynamic Compression**: `compression()` middleware compresses API responses (Brotli quality 5, 1 KB threshold).
  - **SSE Stream Invariant**: `compression()` MUST explicitly filter out `text/event-stream` to prevent buffering server-sent events.
- **Docker**: Multi-stage `Dockerfile` based on `node:26-bookworm-slim`. Published to `ghcr.io/a11delavar/mitra`.
- **CI / Workflows**:
  - `.github/workflows/qa.yml`: Parallel typecheck (`npm run typecheck`), lint (`eslint`), and test (`npm test`).
  - `.github/workflows/docker.yml`: Git-tag driven multi-arch build via `docker/metadata-action`.
  - `.github/workflows/release.yml`: Publishes GitHub Release from top section of `CHANGELOG.md`.
  - `.github/workflows/cleanup.yml`: Prunes untagged GHCR manifests.
- **Changelog**: `CHANGELOG.md` generated via git-cliff (`npm run changelog`, `cliff.toml`).
- **Website Deploy**: `.github/workflows/website.yml` builds `website/` in CI (`fetch-depth: 0`: docs pages date themselves from `git log`) and publishes `ghcr.io/a11delavar/mitra-website` (Caddy, port 8080, amd64 + arm64), whose Dockerfile carries the whole server config. Moved pages go in `moved` in `astro.config.mjs`: the build writes them as Astro redirect pages and as `redirects.caddy` (real 301s, imported by the Caddyfile).

## Conventions
- **Commit Messages**: Single-line `type: Capitalized phrase` (`feat:`, `fix:`, `perf:`, `refactor:`, `docs:`, `test:`, `ci:`, `build:`, `infra:`, `chore:`). Commit subject becomes the user-facing release note in `CHANGELOG.md`; state the end-user effect, not implementation mechanics.
- **Formatting**: Indent with tabs. No semicolons. Files end with a single trailing newline.
- **License**: AGPL-3.0-only (`LICENSE`, `package.json`).
- **Privacy & Placeholders**: No real-world people names or initials in code, tests, or seeds. Use role-based placeholders (`organizer@example.com`, `me@example.com`).
- **Architecture**: Domain-Driven Design and OOP. Business logic belongs on aggregate roots, value objects, and domain collections, not loose procedural helper functions.
- **Comment Brevity & Quality**: Never write verbose, essay-style JSDocs, conversational prose, or line-by-line narrations. Code should be self-documenting. Keep comments strictly focused on non-obvious domain invariants, RFC/protocol edge cases, or platform bugs, distilled into 1–2 concise, high-signal sentences.
