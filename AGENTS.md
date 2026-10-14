# AI Agent Instructions

## Frontend
- **Stack**: TypeScript, Lit, modern CSS, standard web components. Decorators (`@component`, `@property`, `@state`); styles in `static override get styles()`.
- **Light DOM for features** (`createRenderRoot() { return this }`), for global theming and view transitions; register every light-DOM component's `styles` in `Mitra.ts`. Design controls are shadow DOM (§Design Library).
- **CSS**:
  - Nest every rule along the DOM; state is a boolean data attribute nested under its element (`.child { &[data-state] {} }`), never fought with `:host([attr])`.
  - Domain class names (`.header`, `.time`), never structural (`wrapper`, `btn`); flat templates.
  - Logical properties only; no `box-shadow` for one-sided borders (use pseudo-elements).
  - `rem` for layout; `px` only for 1px borders and container query thresholds. Container queries, not media queries.
  - No fallbacks in `var(--theme-var)`. Grid/Flexbox over JS math.
  - `all: unset` overrides `[hidden]`: restate `&[hidden] { display: none }`.
- **Dates**:
  - Frontend: `@3mo/date-time`'s global `DateTime` for formatting and view math (`.equals()`, `.dayStart`, `.format()`), no raw `valueOf()` math. Shared and backend: Temporal (polyfilled by `scripts/injectTemporalPolyfill.ts`).
  - Days and instants meet on `TimeZone`: `zone.dayOf(instant)` is the day it falls on there, `zone.midnightOf(day)` the instant that day begins (`TimeZone.UTC`, `TimeZone.device`).
  - **An all-day entry's dates are days**, kept as UTC midnights in the database, on the wire and on the server. The browser's `Entry` holds each as the midnight that begins it there, a plain field: each date is declared `@Entry.date()`, whose converter reads `allDay` from the same entry and translates only when the entry crosses the wire, in whichever order its fields come (`Entry.dayZone`: the browser's zone, `TimeZone.deviceId`, which asks Intl (50 µs) again only once the offset changes or the page shows again; none on the server, which passes through). Never a getter or setter on a date: views read them thousands of times a frame. `?tz=` only tells the server the viewer's today (the current occurrence of a start-less recurring task), so a write carrying it comes from a stale tab and is refused (409). An `EntryPatch` converts its dates the same way, which is why `EntryPatch.of` brings `allDay` beside a date.
  - Never spread a `PlainDate` (its fields are prototype getters).
  - `ICAL.Time` lives only at the .ics boundary (`CalDAV.instantFrom`/`toICALTime`); zoned writes keep the resource's VTIMEZONE.
  - Mitra extends `DateTime` with members named for its domain in `DateTime.<feature>.ts` (module augmentation): facts as getters, formatting as `formatAs…` methods, as 3MO does.
- **i18n**:
  - Natural English keys (`t('Phrase')`); dotted keys only for long prose and palette keyword blobs (`GoToDate.Keywords`). All 7 dictionaries fully translated, keys grouped by feature. Check a key isn't already used in another sense (`t('On')` vs `Toggle.On`).
  - The locale is `Localizer.locales.current`, an `Intl.Locale` (`en` adopts the browser's region, `en-GB`). Hand it whole to Intl formatters and to the device (push sends `String(locale)`; the server's `localizeIn` reads its language). `.language` is the dictionary key.
  - **Language is a locale** (`LanguageSetting`, value `en` or `en-GB`): seven languages, each with its regions folded under it. `AppLocale` writes the one tag (so `-u-` keywords can join later), probes regions via `resolvedOptions().locale`, always offers `001`/`150`/`419` and names them itself (Chromium can't). A region is a format, not a time zone; `mitra-region-preview` shows what it changes.
  - **Never force a clock**: no `hour12`/`hourCycle`. A time alone is `timeStyle: 'short'`; beside date fields (which `timeStyle` refuses) `hour: 'numeric', minute: '2-digit'`, accepting an unpadded German "1:05". The week axis names whole hours alone on a 12-hour clock ("4 PM", `resolvedOptions().hour12`), else `timeStyle: 'short'` ("16:00", as "16 Uhr" is longer), and a zone column off here by a half hour keeps its minutes ("4:30 PM"); the now label is always `timeStyle: 'short'`.
  - Let the Localizer do grammar: plurals are dictionary arrays, numbers and arrays format themselves, ordinals by `Intl.PluralRules({ type: 'ordinal' })` (`Recurrence.ordinal`). Never interpolate a raw number (`count.format()`, `formatAsPercent()`), never a literal `%` in a key.
  - `i18n/index.ts` re-registers `LocalizerController` on `PageComponent`/`DialogComponent`: lit snapshots initializers at finalize time.
  - Integration `label`s are localized at render; the instance name is `instanceName()` (`MITRA_NAME`, else `t('Mitra')`).
  - Fonts ship from `dist/` (`src/app/fonts.css`: Inter, Vazirmatn by `unicode-range`), never a CDN.
- **Value objects persist themselves**: a static `Mapper` (MikroORM `Type`) for the database and a static `converter` (`@converter(X.converter)`; an object `{ key: … }` names the wire field) for the API, as `EntryType` and `UserTimeZones` do, never a parallel `Stored…` shape. A nullable column reaches the mapper as `null` in both directions, though the ORM loads an empty column as an absent field (`forceUndefined`): the domain holds no `null`.
- **Domain vs view**: domain records (`Entry`, `Source`, `Integration`) hold no layout math; layout is `EntrySegment`/`EntrySegments` in `entries/client/`.
- **Time grid**: one row per layer, everything on it placed by its minute's fraction of the day (chips and availability absolute in their grid area, `inset-block` from `--_from`/`--_to`; hour lines, axis labels and the now line relative, `top` from `--_at`), never 1440 minute rows: Firefox rounds each track to 1/60 px, and a zoom moved what lay deep in the day in 7–15 px steps. One scroller with sticky headers and axis, no JS scroll sync. Overlaps by interval graph coloring, passed only as `--overlap-slot`/`--overlap-total`. Cross-day entries split at the data layer (`getEntriesForDay`), never one element across midnight (`continuesNext`/`continuedFromPrevious` clamp rows and radii). Each day's `.entries` is `content-visibility: auto` (days out of view skip their chips), a stacking context at `z-index: 2` over the day's own surface, so hour lines and connectors stay between; never on the day itself, whose subgrid it drops (layout 15–30× slower). Variables changed per frame (zoom, lane rows) are registered `inherits: false` on `mitra-days`, and the scroll range is set on the connector layers: an inherited one recalculated every element of the week each frame. The lane height snaps, never transitions. Templates never read layout.
- **Popovers** (`design/Popover.ts`): `mitra-popover` is anchored where there is room, centered otherwise (`--centered`, pure CSS), and with `sheet` a modal bottom sheet below `40rem`; its content is slotted, so switching never rebuilds it. `position-try-order: most-block-size` is forbidden.
  - Entry editor: `mitra-entry-details` (`display: contents`) wraps its `.editor` in `<mitra-popover sheet>`, anchored by `show(segment)`; placement `flip-inline, --centered`, declared in its own stylesheet (`@position-try` names are tree-scoped). A sheet focuses its dialog unless something has `[autofocus]`.
  - Test with CDP touch/mouse events, never `segment.open = true`; the editor is open when `mitra-entry-details:has(> mitra-popover[open])`.
- **Forms**: seed form-bound fields with `""`, never `undefined`; `merge` uses `||`.
- **Editor rows** (`.field`, `entries/client/editorFields.css.ts`, scoped to `mitra-entry-details`) strip the inner controls' chrome and anchor pickers to the row. Every checkbox is `mitra-checkbox`.
- **Comments**: only non-obvious constraints and platform traps, one or two sentences. Update AGENTS.md with every architectural decision.
- **Docs** (`docs/`, Starlight Markdown, `> [!NOTE]` alerts, relative links): env vars in `configuration.md`, providers in `integrations/<provider>.md`, views in `views/`.

## Design Library (`src/design`)
- Imports nothing from features or infrastructure (`design/boundary.test.ts`), except `Dialog.ts` → `Mitra.styles`. Registered in `design/index.ts`.
- Controls are shadow DOM with `part`s. A control stamps state on its own parts and nests the rules under them; `:host([attr])` only switches the whole host's layout. `:host(:has())` matches nothing in Chromium.
- **Controls**: `Control` delegates focus to its native input and honors `autofocus`; controls re-emit composed `change` (bind with `live()`). `:state(focus-visible)` lets a context ring a control from outside. Event guards use `startedInField`/`startedOnControl`/`startedInOverlay` (`eventOrigin.ts`, `composedPath()`), never `target.closest()`.
- **Selects & comboboxes**: `mitra-select` is a button plus listbox over slotted `mitra-option`s (`::part(listbox)`, reflects `open`). `mitra-combobox` is `floating` or `inline` (Escape fires `dismiss`); `selected` is a value or an array (multiple).
  - `mitra-option-tree` nests options under a `slot="header"` option, chosen like any other; its chevron (`Option.disclosure`) folds the rest, animated natively (`interpolate-size`, `@starting-style`). Folded options are hidden, never disabled (a disabled option is never selected). Values are unique across a list (the controller keys by value).
  - A listbox holding a tree lays rows on shared columns: tick, the component's own (`--mitra-tree-columns`), chevron; groups, trees and rows are subgrids, a component places parts by column (`::part(content) { display: contents }`). Plain selects keep their row layout.
  - The combobox walks trees itself rather than through @3mo/tree's `TreeController`: that popup is fixed at construction and keyed by element, and leaves Left/Right to a text field's caret.
- **Overlays**: a `mitra-popover` subclass declares its `popoverType` (`'manual'` floating, `null` inline), never a blanket `'auto'`. `mitra-popover-container` pairs trigger and popover without IDs. Pickers render on first `beforetoggle` (every editor holds several closed ones).
- **Fields**: segmented `mitra-date-field`/`mitra-time-field`/`mitra-date-time-field` read their `DateTime` in their `timeZone` (the editor passes its lens, the repeat end `UTC`); the date-time field edits a draft (a pick or closing commits, Escape drops). `@3mo/segmented-input` gives groups `dir="auto"`. `InputField<T>` backs text, search and number fields; `plain` drops the box for a picker's search.
- **Fragments** (`*.css.ts`: `fieldChrome`, `optionRow`, `selected`, `disabled`, `pressable`, `scrollbar`): interpolate with `unsafeCSS`. A context that draws the box itself (the editor's rows) sets `--mitra-field-*`; overlays restore them (`fieldChromeRestored`).
- **Sheets & dialogs**: `mitra-modal-sheet` on 3MO's `SheetController`. Content laid out while closed has zero size (`mitra-tabs` re-reveals on resize). `mitra-dialog` renders in place and announces `pageHeadingChange` only while `boundToWindow`.

## Backend & Database (MikroORM, SQLite)
- STI for `Integration` and `Entry` (`discriminatorColumn: 'type'`); a subclass without columns needs no migration, only `ormConfig.ts` and `registerIntegrations.ts`.
- Date columns are `type: 'Date'`, never `'datetime'` (same column): MikroORM compares a `'datetime'` with `equals`, so the Date it loads never matches the milliseconds SQLite keeps, and every flush rewrote every loaded date (`database/dates.test.ts`).
- **Schema**: every boot runs the migrations (`migrator.up()`), dev included; never `orm.schema.update()`, which reads a column replaced as a rename and knows nothing of data. Entity changes need `npm run db:migration:create -- <Name>` (writes the migration, the snapshot and `migrations/index.ts`); `migrations.test.ts` checks the migrated columns match the entities. A migration runs once, in order, on the shape the one before it left, so it never introspects. Use `await this.execute()` where a step reads data. A database without the migration log is baselined (`migrate.ts`).
- **Table rebuilds**: `foreign_keys = off` does nothing inside a transaction, so dropping a parent cascades. Hold children in an FK-free table, drop and recreate, restore children and references (`user.default_source_id`).
- **Type conversion** (event ↔ task) re-creates the entry (VEVENT and VTODO can't share a CalDAV resource), compensating on failure; series can't convert (400).
- Discovered sources are saved `enabled: false`. `enabled` is where an entry may live (`Calendars.enabled()`); `visible` is a view preference and never removes a destination.
- Local renames survive sync: `Source.remoteName` is the provider's baseline, `name` changes only when the remote one does.
- **Authority**: the backend owns DTSTART, STATUS, TRANSP, SUMMARY, DESCRIPTION; Mitra owns source colors, order, visibility and availability (mirrored upstream as `X-MITRA-*` where possible). The SQLite database is authoritative for users, sessions and local overrides.

## Multi-User & Authentication
- **Modes**: single-user by default (`[default_local_user]`); OIDC with `MITRA_OIDC_ISSUER`, `MITRA_OIDC_CLIENT_ID`, `MITRA_URL` (incomplete config throws). Demo (`MITRA_DEMO=true`, wins over OIDC) opens a `Sandbox` per visitor (`demo-<uuid>` with a `Demo` integration), living `Sandbox.lifetime` (24 h), capped at `MITRA_DEMO_CAP`; dotted paths outside `/api/` never open one; connecting is refused (403).
- OIDC client `identity/server/Oidc.ts` (code + PKCE, `/auth/*`); sessions `Session.ts` (hashed 256-bit cookie, sliding 30 days, `SameSite=Lax`, keeps `id_token` for logout). Unauthenticated `/api/*` is 401, pages redirect to login.
- `Identity` is embedded in `User` (`oidc_*`, unique issuer + subject); `User.provision` creates on first login.
- **Tenant isolation**: query through the `User` (`user.sources`, `user.entries`), never bare `em.find*`; a foreign id is `NotFoundError` (404). `EntryRelation` has no user column, so `targetUid` matches stay in the user's sources. A push endpoint taken over by another user loses its name.
- Errors: `app/server.ts` maps `NotFoundError` to 404 and keeps 4xx/5xx `status`, else 500; an `AggregateError` answers with its first error's status and message, listing all in `errors`.
- **Validation**: a `Validatable<Context>` yields every `ValidationError` it has in a context (`*validate`), never throws; the caller throws them together as an `AggregateError`. A `ValidationError` names its `fields` and answers 400 (`static status`, a subclass may differ). `EntryPatch.validate({ entry, from, to, scope })` judges the edit (its shape alone without a context), `Entry.validate(calendar)` whether a `Calendar` (source and integration) can hold it; routes ask both once.
- SSE, push and reminders are per user. SSE scope `'entries'` (default) or `'sources'` (refetches integrations); entry mutations use `'entries'` so `Source` instances survive.

## The Sample Calendar (`integrations/demo/Demo.ts`)
- One fixture serves dev, every demo sandbox and every screenshot, so keep it calm: one entry per concept, the all-day lane empty around today, days within 07:00–19:00, recurring entries on weekday rules or fixed dates, dependency links in `today−2…today+4` clear of chips.
- `credentials.seededFor` (day plus language) gates the reseed; Re-import applies a seed edit at once.
- Every string is a key in the integration's own `i18n/<lang>.json` (`localizeSample`, server only), calendar names included unless renamed. A sandbox takes `Accept-Language`; a Settings switch sends the language and re-imports (`demo/client/language.ts`), but not for a region alone.

## Integrations & Sync
- `Integration` (STI) subclasses are listed in `registerIntegrations.ts` in display order, with statics `label`, `description`, `logo`, `onePerUser`, `developmentOnly`, `discoversSources`.
- **What an integration can do and hold**, two value objects each integration declares itself, as nothing is assumed (only a real subclass derives, Google from CalDAV): `IntegrationCapabilities`, what it can do (`entries.create/edit/delete/rename/cancel`, `sources.create/delete`, `availability`; `in(source)` turns writes off for read-only sources), and `IntegrationOwnership`, which entry fields it holds and who owns each, `'upstream'` (a re-import brings it back) or `'mitra'` (lost with the integration), keyed by `Entry` field name: `new IntegrationOwnership({ due: 'upstream', rank: 'mitra' })`. Ask, never read a record: `holds(field)` (unheld fields are hidden and refused), `ownerOf(field)`, `ownedBy(owner)`; code writing a field upstream asks `ownerOf(field) === 'upstream'`.
- Engines read entries through `Integration.syncedEntries` (excludes availability), never bare `em.find`.
- Source create/delete routes check the capability, then call `SyncEngine.createSource`/`deleteSource`; renaming needs none.
- **Providers**:
  - **CalDAV** (`caldav/CalDAV.ts`). **Google** extends it with OAuth (`refreshToken`, masked in `toJSON`); Google drops `RELATED-TO` and `X-` properties, so its ownership is CalDAV's `without('relations')`; shared calendars must be enabled at `calendar.google.com/calendar/syncselect`.
  - **Mitra** (`mitra/MitraCalendar.ts`): stored locally, `syncInterval = Infinity`, uri `mitra://local` (one per user). `fetchSources` returns the stored sources unchanged (`[]` would delete them all) and re-import is a no-op. Participants are a record only (nothing is delivered).
  - **Demo**: `MitraCalendar` plus the sample, dev only, reseeding in `syncSource` when the day changes (1 h interval).
  - **Notion** (`notion/Notion.ts`, REST `Notion-Version: 2026-03-11`, PAT): sources `notion://{dataSource}/{view}`; membership query plus a `last_edited_time` delta; no recurrence, reminders, location or time zone (`timeZone` always null). The description syncs as Markdown through `NotionMarkdown.ts`, replacing only replaceable blocks and round-tripping cleanly. Self-relations map to `PARENT`/`FINISHTOSTART`/`X-NOTION-*`; view filters pre-fill new tasks.
  - **ICS feeds** (`ics/`): one feed, one integration, one source; `webcal` becomes `https`; conditional GET plus a body hash.
- Read-only: `Source.readOnly` from CalDAV's privilege set; the editor shows selectable readonly text and hides mutations.
- **Pacing** (`SyncPacer.ts`): the largest of presence (10 s online, 5 min away), the provider's interval, or 60 s after a failure. Coming online syncs at once. No "Sync now".
- **Vocabulary**: Connect (auth and discovery), Import (first fill of a source), Sync (background), Re-import (read again from scratch). "Fetch" is code-only, "Refresh" means reloading discovery.
- **Import** (`integrations/server/Importer.ts`): `apply` saves credentials and sources and returns at once (`importedAt: null`); `Importer.start` drains in the background with a forked EM, emitting `'sources'` per pass, locking per pass. `importedAt` is set only on a complete pass (max 20). Re-import discards entries and answers 202.
- **CalDAV traps**: multiget falls back to single GETs on 404; `writeDate` keeps the authored form (TZID or UTC) and a series' start shift moves its overrides' `RECURRENCE-ID`s; all writes go through `writeResource`, which retries a 412 once; `updateEntry` mirrors changes only after the PUT succeeds.

## Moving and Copying Entries (`sources/server/SourceMigration.ts`)
- Three phases: copy into the target (collecting old → new uids), repoint `EntryRelation.targetUid`, delete the originals. No cross-provider transaction: a failed copy rolls back before deleting; a failed delete leaves duplicates, never loss.
- A copy (`keepOriginals`) skips the delete and mints uids; it repoints only the copies' own rows. Read-only origins copy but never move.
- Lock with `Integration.exclusivelyAcross(ids, work)` (sorted, deduplicated).
- The preview (`migration/MigrationPlan.ts`, `MigrationVerdict.assess`, shared with ICS import) splits blockers from losses by the target's capabilities. Series need recurrence or `flatten: true` (366 days of occurrences). `data.raw` never travels; exclusions travel as `exdates`.

## OS Integration (PWA)
- The manifest (`scripts/indexHtml.ts`) registers `.ics` file handlers, the `webcal` protocol (`/?subscribe=`) and `focus-existing`; `app/launch.ts` dedupes URL and `launchQueue` launches. Dropped `.ics` files are caught; `webcal` opens the dialog prefilled, never auto-connecting.
- `.ics` import (`migration/server/IcsImport.ts`) reuses the copy semantics with its own 25 MB `express.text` route.

## Entries
- `Source.entryTypes` lists `event`/`task`; availability is everywhere, gated by `capabilities.availability`. `EntryType` is a value object; setting `Entry.type` strips what the new type can't hold.
- **Vocabulary** (UI and docs): the **schedule** (`start`/`end`), the **constraints** (**due date**, **estimate**; never "deadline"/"duration"), **planning** (fitting unscheduled tasks), a **moment** (a start without an end).
- **Edits are patches** (`EntryPatch`, a model): a field left out keeps, `null` clears, a value sets; its converters parse it at the boundary. `Entry.apply(patch)` takes one over, then drops what the type can't hold and an estimate a start replaced. The client sends `EntryPatch.of(entry, fields)` (`shared` through an occurrence, `occurrence` for one, scope and occurrence in the address); routes build `new Entry().apply(EntryPatch.of(existing)).apply(patch)` and judge that. An entry holds no `null`.
- **Task model**: end and estimate exclude each other (`scheduleAt`/`unschedule` convert); drags move the schedule, never `due`. A moment (`Entry.point`) has no duration, a series of moments included. `setAllDay` converts `due` too (VTODO needs matching value types).
- **CalDAV tasks**: `DTSTART`, `ESTIMATED-DURATION`, `DUE`; never `DURATION` on a VTODO. Legacy DTSTART + DUE reads as a block.
- **Time zone**: one per entry for all its dates, an `EntryTimeZone` (`Entry.timeZone`): none follows the viewer, `EntryTimeZone.floating` is wall-clock time (`Entry.floating`), else a zone kept in the spelling it was written with (engines spell some differently), whose `clock` is where its wall clock is read (UTC when floating). `Entry.zone` is the `TimeZone` its times are written in. `setTimeZone` keeps the clock times. `TaskStatus`, `Transparency` and `Visibility` are value objects, their columns keeping their CHECK constraints (`@enum` with a `Mapper`). An occurrence's edits travel as plain bodies, which no converter runs on: `wireFields` (`Api.ts`) sends their value objects as codes and `Entry.reviveValues` parses them back, until an `EntryPatch` model replaces both.
- Start-less recurring tasks anchor on `due`; the UI shows only `currentOccurrence`, and scheduling one detaches it (`'this'`).
- **Planning** (`mitra-planning`): Overdue (an open one-off task whose `lastDay` passed; the drag ghost excluded) then Unscheduled (manual order, then due; also the drop target that clears dates). Only one-off tasks unschedule (`Entry.unschedulable`).
- **Manual order**: `Entry.rank` (`EntryRank`, fractional), Mitra's own, never synced; only changed ranks are sent (`PUT /entries/ranks`); a series ranks through its master; re-created entries carry `rank`. Reordering leaves the list into `EntryDragController.beginExternal`.
- **Editor dates** (`EntryDetailsWhen`): one row per field (start, end or estimate, due), then zone and repeat; the All day toggle sits on the row in use; ✕ on a start unschedules, on an end makes a moment.
- `GET /entries` also carries undated entries and open tasks overdue before the window (`entries/server/entryWindow.ts`, shared by route and test).
- Drawer tabs (`design/Tabs.ts`) always scroll LTR (panels reversed in RTL): Chromium misplaces a `view()` timeline in a scroller whose origin is its inline end.

## Calendar Views
- **Weeks follow the locale** (`DateTime.weekStart`): every grid starts there, never at `dayOfWeek === 1`; a locale switch rebuilds the buffers.
- Views: `mitra-days` (week), `mitra-weeks` (month), `mitra-months` (year), `mitra-timeline`, `mitra-table`.
- **`EntrySegments`**: `for(entry)` memoizes per-day segments; `timedOn(day)` clusters; `runsIn` reads a per-cohort day index; lane packing is unbounded, overflow clipped behind a fade; ties order by heading (`laneOrder`), never arrival. Cache `.dayValue` in hot loops.
- **Drag** (`EntryDragController`): create, move, resize (0.25rem handles). Cells are picked by nearness (`DayCells`: days sit a hairline apart, so the line between two belongs to one of them), gated by `places()` (the grid minus the sidebar). A move keeps the offset from the grabbed point (a chip from the planning list anchors at its own start). Never `setPreview` an unchanged span (`spanEquals`), or every chip repaints each frame. A drag step notifies through `EntryStore.notifyMoved` (the views, the chips showing a moved entry, `new EntryStore(this, { entry })`, and the hosts whose shown value it changed, `{ shows }`: the sidebar's badge count, the connectors' segments), never `notify()`; `timedOn` hands a day whose segments did not change its very list again, so lit skips it. Pinned by work-count tests, not timings. One local draft (`EntryStore.draft`, id 0).
- **Scrolling** (`CalendarScrollController`): date-anchored; a navigation also arrives on the cross axis (today's now line, else midday); a scroll echo is told apart by identity. Zoom (`DensityController`: Ctrl+wheel, rail wheel, pinch).
- **Time zones**:
  - **A zone is a `TimeZone`** (`features/time/TimeZone.ts`) past the Intl/Temporal boundary (the platform has none since Temporal dropped it). `of` interns one instance per zone through Intl's spelling (Chromium and Node spell zones the CLDR way, Firefox the IANA way) and throws on unknown ids, so `equals` is identity; never Temporal's, whose native engines merge zones CLDR keeps apart (Oslo into Berlin). `parse` reads untrusted values.
  - **Home and here** (`UserTimeZones` on `User`): the account stores home and the added zones, each optionally named; here (the device's zone) anchors the grid and is never stored, so a trip changes nothing. Home is set once from the first device (`settle`) and replaced by `makeHome`, never removed; naming here keeps it. The server applies one command per request (`/user/time-zones/…`), never a whole list. `User.timeZones` is the value object itself, stored and sent through its own `Mapper` and `converter` (as `EntryType`), empty until the account keeps a zone. House is home, pin is here.
  - **Names** (`TimeZoneName`, Intl only): the reader's abbreviation, else the zone's own region's (Latin-script readers only), else its place (`shortGeneric` minus the locale's pattern, learned from Japan), else the offset. A zone's region comes from `getTimeZones()` over every region.
  - **Picker** (`TimeZoneDirectory`): zones grouped by name and both yearly offsets, the reader's region first; a row stands for here or home, else CLDR's golden zone (`TimeZone.isGoldenIn`: Toronto in Canada, New York elsewhere), which Intl hides; `npm run zones:generate` writes `goldenZones.json` (current names only, both spellings).
  - `TimeZoneLaneController` folds the extra columns (the anchor never folds).
- The week's all-day lane uses explicit row tracks (`repeat(var(--slots), var(--slot-height))`), never auto-flow.
- **Chip heading** (`EventSegment.ts`): two layouts switched by the space toggle `--inline` (no `if()`: Chromium only). The when line is `DateTimeRange.format()`, never hand-assembled; `dated` adds the day off the grid.
- **Month** (`mitra-weeks`): week rows with subgrid columns and CSS density scaling; `.entries` at `z-index: 2` over connectors; per-week layouts memoized; an ISO week rail (labelled by each row's Thursday); zoom 2–9 weeks with a quantized settle.
- **Year** (`mitra-months`): a strip of mini months with subgrid lanes; `overflow-anchor: none`.
- **Timeline**: open scheduled tasks, one row each, virtualized by plan; routines show due occurrences only; sticky `.jump` buttons.
- **Table** (`calendar/client/Table.ts`): a `TableWindow` from today, no paging; the unbounded window lists a series once (`seriesStarts`, scope `'all'`).
  - A `div[role=grid]` with subgrid rows, never `<table>` (lit foster-parents out of `<tbody>`; Chromium drops subgrid under `content-visibility`).
  - Sticky header row (not cells) and sticky `.actions`; a hidden `.anchor` row holds each column's widest content.
  - The resize line lives inside its handle, never `position: fixed` (`.calendar` has `contain: layout`).
  - Cells reuse editor components; batch edits run series occurrences one by one; `TableRowComponent` keeps a field's keys from the grid.

## Routing & URL
- One route (`PageCalendar`, `/:view`), overlays and filters as query parameters (`?date=`, `?selected=`, `?settings=`); `CalendarLocation` parses and writes them; today is omitted.
- `PageCalendar` is the only writer: it derives `url` from live state and restores from the address bar, never from `parameters` (the router hands back the first navigation's).
- `UrlSyncController` replaces, never pushes (100 ms debounce, flushed on `pagehide`), and skips writes when nothing changed.
- Device preferences (zoom, sidebar, folding, the table's window) live in `localStorage`, out of URLs.
- The server's SPA fallback must be `res.sendFile('index.html', { root })`: without `root`, a dotted path (a `.claude` worktree) 404s.

## View Transitions
- `transitionCalendar` (`calendar/client/calendarTransition.ts`): a scoped transition on `.calendar` (Chromium 147+) for view switches and visibility changes only; at most 40 named entries near the center; `::view-transition { pointer-events: none }`.

## Commands
- One class per action extending `Command`; facts are `abstract readonly` fields, getters only for live state; always run through `dispatch()` (absorbs `DialogCancelledError`). Context comes from `Mitra.instance.calendar`. Header buttons are the commands themselves (`PageCalendar.commandButton`).
- `commandInstances()` caches instances and rebuilds them on a language change; never `new` the registry per render.
- **Palette** (`mitra-command-palette`): a `<dialog>` around an inline combobox, opened by `/`, Ctrl+P, Ctrl+K. Its `commands` is a function, asked only while open. One search rule for the app (`termsMatch.ts`). Entries come from `GET /entries/search` (`entrySearch`); a series hit becomes its nearest occurrence (`nearestOccurrence`), never the master id.
- **Editor intent** (`EntryEditorIntent`): `openDraft`/`requestOpen`, anchored on hosting surfaces; `settle` clears unmatched intents; span edits re-request after render and dispatch `reveal` (scroll to it, or open the Planning tab).
- **Keys** (`PageCalendar.handleKeyDown`): ignore fields, IME composition, chords and open dialogs. Read keys through `KeyPress`, never `e.key` alone: the typed letter on Latin layouts (AZERTY, QWERTZ), the physical key where a layout types another script (Persian).

## Settings
- One class per preference beside its feature (`Setting.ts`); `app/settings.ts` only orders them. Settings own defaults and options; domain code takes preferences as parameters. The server bundle excludes client settings (`bundles.test.ts`).
- Storage: `userStorage` (`User.settings`) or `deviceStorage`; only deviations are stored (`undefined` removes, `null` is an explicit none). `UserSettings` sanitizes without importing settings.
- `details` renders a full-width block under the row. Scroll containers need inline padding, or they clip focus rings. Settings add palette verbs (`settingCommands()`). The dialog is searchable, two-pane, opened from the sidebar, the palette or Ctrl+, (`PageCalendar.openSettings()`).

## Recurrence & Routines
- One master with an RRULE (`Recurrence` value object); occurrences expand on read; edited exceptions are rows with `RECURRENCE-ID`.
- RFC 5545 counts month days, nth weekdays and yearly dates in Gregorian months: use `start.recurrenceDate`/`start.formatAsAnniversary()`, never the display calendar's `start.day`.
- A rule's parts are value objects, persisted by their own `Mapper`s into the columns as they always were: `freq` a `RecurrenceFrequency` (one instance per code, `days`, `format(every)`), `byday` `RecurrenceWeekday`s (`Monday`…, `nth(-1)` the last; `week()` and `workdays()` follow the locale's first day and `getWeekInfo().weekend`, Saturday to Thursday in Persian), `until` a `RecurrenceEnd` (a UTC calendar day: `of`, `before`, `parse`, `toRRule(allDay)`; on the wire as the UTC midnight it always was, in the column as that in milliseconds). Models hold plain data, never a Temporal object: the API client `structuredClone`s request bodies, which native Temporal refuses (Node tests run on the polyfill, which clones), and dirty checks compare deeply, where `PlainDate#valueOf` throws. Their `format` defaults to `Localizer.locales.current`, imported explicitly: the global exists only once something imports @3mo/localization, and under Node the Localizer falls back to `navigator.languages`.
- A day in an address or a stored key is `date.isoDate` (ISO whatever calendar it reads in, `calendar/client/DateTime.calendar.ts`).
- Scoped edits (`editOccurrence`): 'this' detaches, 'following' splits, 'all' rewrites the master, adopting the edit's duration (none for a moment). Each may also move calendars (`movingTo`); the client must send `sourceId`.
- **Routines** collapse dense series into one ribbon mark per day in month and year views, pooled by source and heading, when the stride is under a row unit (week slack 1.0, month 1.25) with at least 4 instances.

## Reminders & Push
- Reminders count back from `Entry.reminderAnchor` (start, else due for unscheduled tasks); `unschedule()` clears them unless a due remains; closed tasks never fire. CalDAV TRIGGER is `START`, or `END` against DUE for unscheduled tasks (`CalDAV.reminderAnchorOf`).
- The server renders each notification per device (`ReminderNotification.for`) in its `locale` and `timeZone`, via `localizeIn`; the worker only shows it. The body states the time, never a countdown. At most 2 buttons; Done posts `/entries/:id/complete`.
- Push sets `TTL` (anchor + 5 min) and `urgency: 'high'`; `icon` goes to Android only.
- `ReminderScheduler` claims `(watermark, now + interval]`, sets exact timers, persists the watermark, dedupes in memory. Floating times resolve in the device's last zone.
- Devices are listed under Settings → Notifications; `register` keeps the user's `name`; a rotated subscription inherits name and locale (`succeed`). The page re-registers on a locale change.

## Participants
- `Entry.participants` (JSON); `ownership.holds('participants')` (not for Notion); only the organizer edits the list (server-enforced); identity from `Integration.addresses`; CalDAV mapping in `CalDAV.participantsFrom`/`writeParticipants`.

## Relationships (RELATED-TO)
- `RelationType` values; stored on the dependent entry by `uid` (`EntryRelation`); written as the entry's owned relations alone (`updateRelations`), outside entry dirty checking. `Entry.relations` is an `EntryRelations`: absent is unknown (a provider may not say), an empty collection is none, the wire an array. Its views of this entry's side (`lines`, `sections`, `edges`) take the uid when asked, as an entry's uid can change after its relations arrive; CalDAV diffs `RELATED-TO` lines. `ShiftStrategy` moves dependents. Rebuilding `entry` must hold `entry_relation` rows.
- **Progress** (`RelationGraph.rollupOf`): subtasks and `- [ ]` checklist items count equally; ticking a box edits the description only (`Checklist.toggle`), never status. Tasks only.
- `mitra-markdown[interactive]` numbers checkboxes in document order and emits `check`.
- **Connectors** (`EntryConnections.ts`): routed by grid columns. Into the neighbouring column, a clear pair gets a vertical S-curve, anything closer a `bend` (two arcs of `BEND_RADIUS`), drawn in pure CSS (container units and trigonometry), emitted twice with the wrong twin hidden by a container query. Lane and canvas layers split the edges by realm.

## Availability
- `EntryType.Availability`: repeating windows in the calendar's color, free by default, stored locally, never in `EntrySegments` or routines (`Availability.outside()`), drawn in the week view as `mitra-availability-segment`. Excluded from search, relations, participants, reminders and all-day lanes. `HideAvailabilitySetting` hides it everywhere.
- Busy windows publish to CalDAV as `mitra-availability-<uid>` series (`SyncEngine.publishAvailability`), retried on sync.
- `EntryEditorIntent.shouldOpen` matches occurrences only, never masters.

## Links
- Derived, never stored: read from the description and a location that is one link (`MarkdownLinks.of`/`sole`). The editor's Links row only reads; its `li` is always rendered (hidden when empty) so lit never rebuilds the textarea below.
- One linkifier, `MarkdownLinks.marked`, renders and reads; never `marked.use()` (`NotionMarkdown` uses the global instance). `MarkdownLinks.allows` refuses `javascript:`, `data:`, `file:`.
- `mitra-link` (`design/Link.ts`) names a bare address by host, meeting service or app (its own tables).

## Sidebar
- `mitra-source-icon` reads everything from its `.source`, never mirrored properties. One grid (`.integrations`, `--sidebar-gap`) aligns every row and heading; other source lists reproduce it. `scrollbar-gutter: stable`. The default calendar is `Calendars.primary()`. `Calendars` (`sources/client/`) is the client's store of integrations and sources; `Api.ts` only calls the server.

## Website (`website/`)
- One Astro project: the homepage plus Starlight over `../docs` (linked by `prepare.mjs`). `tools/tokens.mjs` emits the look from `src/design`.
- Rewrite raw HTML in remark, never rehype (`remarkDocsAssets`); clear `.astro` caches after changing a plugin. Use animation longhands with `animation-timeline` (the minifier breaks the shorthand).
- **Captures** (`npm run screenshots`, harness `scripts/capture.ts`): wait for a stable non-zero count of `mitra-entry-segment, mitra-table-row`, never a delay; real input; frozen at Thursday 2026-10-01 10:20, Berlin, `en-150`, reduced motion, availability hidden outside its guide. English stills are committed; other languages are shot in CI (`--language de`, gitignored). Scenes find elements by dictionary text (`appText()`), never English.
- **Films** (`scripts/film.ts`) step Chrome's virtual clock frame by frame between real pointer events (the fetch-waiting policy never advances: SSE). CRF 16; ffmpeg on PATH. `MOTION_TRACE=1` logs.
- Copy: plain sentences, no em or en dashes, no emoji bullets; quote a `description` with a colon.
- **Translations**: the file beside the English one (`week.de.md`), complete or absent, keeping the English headings in number and order (anchors come from English). Change translations with their page (else an outdated notice shows), and translate a release's notes before its tag. The site's words live in `website/i18n/<lang>.json` over the app's dictionaries; `npm run i18n:analyze` checks both and the headings.
- `robots.txt`: the site's points to the sitemap; the app's disallows everything.

## Releases (`releases/`)
- One folder per minor: `README.md` (title, a date once shipped, an intro, a `##` per highlight, optional `Upgrading`, `Why Mitra` letter and `Contributors`) beside its captures (`name-light.webp`/`-dark`, films with posters).
- `npm run captures:release <minor>` shoots `releases/<minor>/scenes.ts`; captures are made once and kept. The rest of a release is its `CHANGELOG.md` section; `npm run release x.y.0` refuses without a titled README.
- A patch of an older minor (a backport) is cut on a branch from that minor's last tag, cherry-picking from main; only its tag is pushed, so no branch stays and nothing lands on main.
- `ReleaseNotes.parse()`/`Release.list()` (`features/about/`, pure) serve the app, scripts and site; a release's state comes from dates and order. One stylesheet, `releaseNotes.css.ts`, is worn by the app and emitted for the site (folded commit list included); fixes and performance read as Improvements, maintenance as a count.

## Build, Test & CI
- Node 26. `npm run typecheck` (TypeScript 7, the one entry point; `typescript` aliases 6 for typescript-eslint). `npm run lint` (tabs, single quotes, no semicolons, final newline, `max-lines` 1000, no `console.log`). `npm test` bundles `src/**/*.test.ts` for `node:test`. `npm start` watches; `npm run build` needs `data/`. Scripts run their TypeScript through Node's type stripping, so code they import has no parameter properties or enums.
- **PWA icons** (`scripts/indexHtml.ts`): a dedicated `maskable` icon (never `any maskable`) at 50% over `themeColor`; the monochrome mark ships only as `notification-badge.png`, never a `monochrome` manifest icon (Edge paints it black). Notification `icon` is Android-only.
- **Compression**: build-time `.br`/`.gz` served by `precompressed(dist)`; `compression()` for the API must skip `text/event-stream`.
- Docker `node:26-bookworm-slim` → `ghcr.io/a11delavar/mitra`; workflows: `qa.yml`, `docker.yml` (tags; `latest`, `X` and `X.Y` move only for the newest stable tag they cover, so a backport never takes them back), `release.yml` (a backport is never Latest, and dispatches a website build of main), `cleanup.yml`, `website.yml` (`fetch-depth: 0`; moved pages in `astro.config.mjs` `moved`).
- **Changelog**: generated and gitignored (`npm run changelog`, `scripts/changelog.ts` over git-cliff and `cliff.toml`): CI writes it for the image, the release and the site, never a commit. The script adds each backport tag of HEAD's minor or older from its own range; `--tag vX.Y.Z` names the commits past the last tag, `--unreleased` keeps them as `[Unreleased]`. Every `type: Phrase` line of a commit body is an entry of its own (`split_commits`); any other line is skipped.

## Conventions
- Commits: one line, `type: Capitalized phrase` (`feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `ci`, `build`, `infra`, `chore`), stating the user-facing effect; it becomes the release note.
- Tabs, no semicolons, a final newline. License AGPL-3.0-only.
- No real people's names in code, tests or seeds; role placeholders (`organizer@example.com`).
- Domain-driven, object-oriented: behavior on aggregates, value objects and collections, not loose helpers.
- Comments: one or two sentences on a non-obvious invariant, protocol edge or platform bug; no narration.
