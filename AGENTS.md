# AI Agent Instructions

When writing code for this project, you must adhere to the following architectural constraints:

- You are an expert in TypeScript, Lit, and modern CSS.
- Use standard Lit decorators (`@component`, `@property`, `@state`).
- Keep components small and reactive. Use Light DOM encapsulation (`createRenderRoot() { return this }`) to ensure seamless View Transitions and global themability.
- Do not use heavy frontend frameworks (React/Vue). Stick to standard web components.
- Write concise, performant code. Avoid over-engineering.
- For CSS, use standard nested CSS or modern native features (Container Queries, `color-mix`, native CSS variables).
- **Nested CSS:** All CSS rules MUST be nested to reflect the DOM hierarchy rather than using flat top-level class declarations.
- **Idiomatic HTML/CSS Naming:** Treat CSS class names as public APIs that could be externally themed. Avoid technical or structural terms like `btn`, `wrapper`, `container`, `layout`. Use concise, unified, and semantic idiomatic names that represent the domain (e.g., `.header`, `.entries`, `.time`, `.start`, `.end`, `.more`). Component templates should be as flat and simple as possible without redundant wrapper divs.
- When generating Calendar layouts, strictly use the CSS Grid approach.
- **Prefer CSS over JS:** If a layout can be solved with CSS Grid or Flexbox, do not use JavaScript math.
- **Calendar Grid:** The vertical time-grid uses `1440` rows. Map minutes directly to grid rows (e.g., 9:00 AM = row `540`).
- **Overlaps:** JS-based collision calculation is permitted *only* to assign `slot` and `total` overlaps. This data MUST be passed to the `<mitra-entry-segment>` instances strictly as CSS Custom Properties (e.g. `--overlap-slot`, `--overlap-total`), allowing CSS container queries to cleanly disable the clustering in narrow views (e.g., list views) without fighting JS logic.
- **Responsiveness:** Use CSS Container Queries (`@container`) instead of media queries. Components should adapt to their parent container's size, not the viewport.
- Strongly type all JSON API contracts from the backend proxies.
- **Dates and Times:** Always use the `@3mo/date-time` package and its `DateTime` global class (which utilizes the Temporal API) for any date, time, or formatting operations. Avoid raw `Date` objects or other libraries.
- **2D Scroll Architecture:** Use a single scrolling container (`overflow: auto`) for the calendar viewport. Achieve 2D locked headers via `position: sticky` (`top: 0` for day headers, `left: 0` for the time axis, and `top: 0; left: 0;` for the top-left corner). Do NOT sync separate X and Y scroll containers with JavaScript.
- **Dynamic Minute Sizing:** To avoid browser sub-pixel layout limits (like `1fr` flooring at 1px), enforce the vertical 1440-row grid to fit its container using dynamic percentages (`--minute-height: calc(100% / 1440)` on a `height: 100%` grid).
- **Entry Clustering (Interval Graphs):** When resolving parallel entries, use strict Interval Graph Coloring logic to segment clusters completely before calculating columns and spans. This prevents disjoint entries from falsely grouping via distant shared neighbors.
- **Cross-Day Entries:** Do NOT attempt to span a single DOM element across multiple days. Split entries crossing midnight at the data/selector layer (e.g., `getEntriesForDay`). Pass the *original unmodified time range* to the UI component for accurate text display, but use boolean flags (`continuesNext`, `continuedFromPrevious`) to mathematically clamp the grid rendering between rows `1` and `1441` and to strip border radii visually.
- **Layered domain/view separation:** `shared/` holds *persistence/domain records only* (`Entry`, `Source`, `Integration`/`CalDAV`) + API models — no view concerns (do NOT put things like a calendar `laneRank` on `Entry`). Calendar layout is a **frontend** concern: `EntrySegment` (in `frontend/`, not `shared/`) is one entry projected onto a single day and owns its per-day geometry (`startMinute`/`endMinute`/`allDay`/`hasPrevious`/`hasNext`/`runEnd`/`overlaps`/`fallsOnDay`), all derived from `(entry, date, previous/next links)`. The `EntrySegments` cohort owns every *cross-segment* computation. Keep this math out of the rendering components — `mitra-entry-segment`/`mitra-entry-details` are "decorations" that only read their segment for content/colour/identity while the view sets placement inline.
- **DateTime Operations:** Avoid raw `valueOf()` date math or manual year/month comparisons. Always use the native `@3mo/date-time` `DateTime` instance methods (`.equals()`, `.isBefore()`, `.isAfter()`, `.dayStart`) for bounding checks and equality. Rely on `DateTime.format()` to render strings so time values naturally inherit the system locale (e.g. Persian numerals).
- **RTL / Localization Support:** Always utilize CSS Logical Properties (e.g., `margin-inline-start`, `inset-inline-start`, `border-end-start-radius`, `padding-inline-end`) instead of physical directional properties (`margin-left`, `left`, `border-bottom-left-radius`) to ensure the application natively works in both LTR and RTL layouts. Avoid using `box-shadow` for asymmetrical borders (use pseudo-elements instead).
- **CSS Nesting / Shadow DOM Constraints:** Rather than fighting `:host([attr]) .child` selector specificity issues, attach boolean data attributes directly to structural markup (`<div ?data-state>`) and leverage native CSS nesting (`.child { &[data-state] { ... } }`).
- **Lit CSS Workaround:** Place all CSS directly within `static override get styles() { return css\`...\` }` rather than using `<style>` tags in the template. Use `import { css } from 'lit'` if `@a11d/lit` does not export it.
- **Scalable CSS Units:** Use `rem` instead of `px` values for most layouts (padding, margin, font-size, widths) to ensure responsive geometry. `px` should generally only be reserved for absolute rendering rules (like 1px borders or `@container` query thresholds).
- **CSS Variable Fallbacks:** Never hardcode default fallback values for theme variables (e.g., use `var(--color-background)` instead of `var(--color-background, #191919)`) since theme variables are guaranteed to exist globally.
- **Backend ORM Strategy:** Exclusively use SQLite with MikroORM. Utilize Single Table Inheritance (`@entity({ discriminatorColumn: 'type' })`) for polymorphic domain models like `Integration` and `Entry` to allow simple querying of complex inherited data.
- **Background Sync Architecture:** All data synchronization should occur entirely in a background daemon (e.g., `server.ts` loop) that polymorphically iterates over all base `Integration` records. Do NOT block frontend API reads with live external syncs; the frontend `/api` routes must always query instantly from the local SQLite store.
- **CalDAV Sync Quirks:** When syncing CalDAV via `tsdav`, **do not** use `smartCollectionSync` or `smartCollectionSyncDetailed`. It has a hardcoded bug that filters out any calendar URLs that do not end in `.ics`, breaking platforms like some CalDAV servers. Always implement manual WebDAV XML syncing by passing `client.syncCollection()` directly and fetching `changedUrls` manually.
- **Opt-in Data Flow:** Newly discovered external sources (like new calendars) should always be persisted to the DB with `enabled: false`. Do not perform heavy `Entry` syncing loops until the user explicitly enables a source.
- **Living Architecture:** Whenever a new architectural decision is made by the user, **ALWAYS** add it to this `AGENTS.md` file immediately so that rules compound and the user doesn't have to repeat themselves.

## Calendar layout & segmentation (current model)

- **`EntrySegments` (frontend cohort) is the whole layout engine** — small, because CSS does the placing. Build via `EntrySegments.of(entries, days)` (memoised on `days`). API:
  - `EntrySegments.for(entry)` — the entry's per-day segments, linked `previous`/`next`, memoised so instances are stable across renders.
  - `timedOn(day)` — the day's timed segments clustered into side-by-side columns (the *one* genuinely cross-segment computation; writes each segment's `overlap = {slot,total,span}`).
  - `runsIn(from, to, accept)` — one representative segment per matching entry whose run touches the window, sorted so DOM order drives CSS `grid-auto-flow: dense` lane packing. Used for the week all-day lane and per-week in month.
  - `monthSlots` / `monthWeek(week, maxSlots)` — month packing. Month keeps a *computed* slot (unlike the all-day lane's pure CSS auto-flow) because its "+N more" overflow needs exact lanes.
  - `static laneRank(entry)` — lane ordering for month packing (a view concern, hence here and not on `Entry`).
- **Self-placement:** views map a date → grid column themselves (build a `Map<dayValue, index>` once per render — never `findIndex` inside `.map()`) and set `grid-column`/`grid-row`/`--overlap-*` inline. The all-day lane self-places columns by date and lets `grid-auto-flow: row dense` assign lanes (no JS lanes). `CalendarLayout` (an old shared class) was removed — don't reintroduce it.

## Build / test / run

- **Typecheck (one-shot):** run `tsgo` (`node_modules/@typescript/native-preview-<platform>/lib/tsgo[.exe] --noEmit`). esbuild does NOT typecheck.
- **Tests:** `npm test` → `scripts/test.ts` esbuild-bundles `src/**/*.test.ts` → `out_test/`, then `node --test`. Use the Node built-in runner (`node:test` + `node:assert/strict`) with real `DateTime`.
- **Dev:** `npm start` → `scripts/dev.ts`: `tsgo --watch` + esbuild watch for backend (`out/server/server.mjs`, run via `node --watch`) and frontend (`dist/`).
- **Dev sample data:** `src/backend/devFixture.ts` (`SampleIntegration extends CalDAV`, never persisted) is merged read-only into `GET /api/integrations` + `/api/entries`, gated by `process.env.MITRA_DEV` (set only by `scripts/dev.ts`). Toggling it needs a full `npm start` restart (the env is fixed at spawn).

## Conventions

- **Commits:** single-line `type: Capitalized phrase` (`feat:`/`fix:`/`refactor:`/`chore:`). Commit ONLY when explicitly asked.
- Indent with **tabs**.
- Public repo: keep secrets/credentials and personal identifiers out of committed files; leave the git author config unchanged.