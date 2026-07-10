# Timeline View v0 — Research & Design

*Research synthesis + decision log, July 2026. Inspirations: Notion Timeline, GitHub Projects Roadmap, plus the broader PM field (Asana, ClickUp, Toggl Plan, TickTick, Linear, Motion). This doc records the reasoning; delete or trim before merge if desired.*

## 0. Decision log (TL;DR — read this first when returning)

| Decision | Chosen | Alternatives considered | Revisit when |
|---|---|---|---|
| What the view is | Timeline for the 2wk–6mo planning band; Gantt is the *trajectory* (dependencies soon, child entries later) | Pure Gantt now; year-strip view | Dependencies land |
| What renders where | **Context/work split**: all-day events → header bands + ~10% day tint through the body; tasks → body; timed events → hidden entirely | (a) everything in the body (first attempt — drowned spans in meeting-pill noise); (b) tasks only; (c) event-with-child-tasks as header checkpoints (needs hierarchy) | Parent/child entries exist, or add `X-MITRA-TIMELINE=include` ICS opt-in for timed events people work towards (e.g. "Math Exam at 11:00") |
| Row layout | **Packed lanes** (`grid-auto-flow: row dense`, non-overlapping runs share a lane) | One row per entry (Notion/GitHub) — right for curated 10–30-item sets with a left table, dies at whole-calendar volumes; vertical density = workload signal | Hierarchy + left table panel arrive (natural flip point) |
| Future dependency arrows | CSS Anchor Positioning (bars already have `anchor-name` via the segment component); packing does NOT block arrows — `anchor()` resolves rendered geometry | JS-computed lane layout to expose bar coordinates (rejected: platform does it; user prefers modern CSS to the fullest, Chromium-only OK) | Building arrows |
| Zoom | Continuous `--day-width` (zoom = days-the-viewport-spans, 21–180, persisted), ctrl+wheel/pinch/wheel-over-header, cursor-anchored + eased | Discrete Month/Quarter/Year dropdown (Notion/GitHub) | — |
| Header labels | Months row + day numbers that thin to week-starts via per-cell container queries (fluid month↔quarter transition) | Discrete per-zoom label sets | — |
| Weekend shading | **Removed for now** (user call, 2026-07-10) — cells keep `dayOfWeek` knowledge if it returns | Shading weekends (GitHub's top-voted missing feature; was in the first build) | If the flat canvas proves hard to scan |
| Grouping/swimlanes | None — flat canvas, all sources blended (like week/month views) | Group by source (Notion group-by, GitHub group-by) — "not something we are able to do yet and not needed" | Far future, if ever |
| Unscheduled/no-date tray | Deferred — it's a cross-view product question (week/month too), not timeline-only; layout must not preclude a future edge panel | In-view tray (every surveyed tool has one; Notion's phantom-bar click-to-place is the likely mechanic) | Dedicated cross-view effort |
| Gestures | Full reuse of `EntryDragController` via a new `'timeline'` grid discriminant: day-granular move/resize, drag-to-create all-day drafts, click-to-quick-create (like month), tap-to-open | Read-only v0 first | — |
| Naming | `Timeline.ts` / `mitra-timeline` / view key `'timeline'`, hotkey `L` | `Months`/`mitra-months` per the "views are named after the stripped unit" convention — rejected: the identity is the canvas, not the unit | — |

## 1. What we're building and why

A horizontal time view where entries render as bars against a day-granular axis. It targets the **2-week-to-6-month planning band** — the gap between the week view (too granular for planning ahead) and any future year view (too coarse). Research is unambiguous that this is where a timeline beats a calendar for an individual:

- **Multi-day spans** (a trip, an exam-prep phase, a renovation) render poorly on calendars as repeated all-day strips; on a timeline they're one legible bar.
- **Parallel streams**: seeing that a month is overloaded across several commitments at once.
- **Deadline landscapes**: upcoming due dates as a scannable sequence.

Terminology note: without dependency arrows this is technically a *timeline*, not a *Gantt* (the field draws the line at dependencies). But **the trajectory is Gantt**: dependencies between entries are planned for the near future (arrows), and possibly collapsible child entries later. v0 decisions below are chosen to not obstruct that path.

### Non-goals for v0
- **No dependencies** (near-future work; see §6 for how v0 keeps the door open).
- **No grouping/swimlanes** (e.g. by source) — deliberately excluded; Mitra's views treat all visible sources as one blended surface, and grouping isn't something the product can meaningfully do yet. At most a future direction.
- No markers system beyond the today line (see §4.2).
- No load-limit/virtualization machinery beyond what the existing date-window controller gives us.

## 2. What the inspirations actually do

### Notion Timeline
- Zoom levels: Hours / Day / Week / Bi-week / **Month (default)** / Quarter / Year; `Today` button top-right.
- Strictly **one item per row**, no packing, no per-bar colors — both documented weaknesses we can beat (Mitra has source colors and personal-scale packing needs).
- Range items = bars; single-date items = one-day blocks, edge-drag turns them into ranges.
- Undated items: hidden from the canvas; live in the optional left table; hover the lane → phantom bar → click to place.
- Per-row **off-screen jump arrows** (◄/► when an item's bar is outside the viewport) — a strong pattern worth copying eventually.
- Positioning vs calendar (their own docs): *timeline answers "how long and what overlaps"; calendar answers "what happens when."*

### GitHub Projects Roadmap
- Zoom: Month / Quarter / Year. Two-row header always: **month names on top, day/week numbers below** — granularity of the second row and gridlines changes with zoom (days → week-starts → month boundaries).
- **Today** = red hairline through the body + red dot in the header + Today button.
- Strictly one item per row (table-like). Single-date items render as a point/one-day pill; no-date items keep a table row with an empty timeline.
- **Markers system**: iterations, milestones, and key dates render as *top-axis labels + full-height vertical lines behind the items* — never as rows. Rows are exclusively work items; calendrical context lives on the axis.
- Top community complaints: no weekend shading (top-voted), no dependency arrows, awkward horizontal navigation.

### PM field distillation
- **Three render species** for a time axis: duration **bars** (ranged items), **point markers** (single-date items — diamond is the universal zero-duration/milestone convention), and **full-height vertical lines** (dates that apply to all rows: today, holidays).
- **Packing**: Gantt tools force one row per task; timeline tools (Toggl Plan, vis-timeline) pack non-overlapping items into shared lanes. For personal volumes, packing is the right default — one-row-per-entry dies at personal task counts. Known edge case: items that merely *touch* (end == next start) must not stack.
- **Unscheduled tray** with drag/click-to-schedule is table stakes — every surveyed tool has one (Asana "Unscheduled tasks", ClickUp sidebar with *Unscheduled + Overdue*, TickTick "Schedule Tasks" panel, Todoist "Plan sidebar", Notion's table pane).
- **Timed (clock-time) items barely matter at timeline zoom** — day granularity is the layout input; clock times are detail. Tools that mix tasks and events either overlay events as context (Motion) or exclude small items entirely (Linear shows projects only).
- Known pitfalls: clutter at scale (mitigate: packing, filters, zoom), meaningless durations for tiny tasks (mitigate: point markers below a width threshold), horizontal-scroll fatigue (mitigate: today anchor, clamped range, jump-to-today), plans rotting (mitigate: the timeline is a *projection of entry dates*, never a second data model).

## 3. Mitra fit — what the codebase already gives us

- `Entry.type: 'event' | 'task'` is first-class (derived from `Source.type`); tasks have `status` + the `mitra-task-status` checkbox; events don't.
- `start`/`end` are nullable → **undated entries exist in the domain but no view renders them today**. `EntrySegments` already produces dateless segments (`laneRank` 3).
- All-day `end` is stored **exclusive** (next midnight); bar length math must use `Entry.inclusiveEnd`/`effectiveEnd`.
- `EntrySegments.of(entries, days).runsIn(from, to, accept)` returns exactly what a bar row needs: one representative segment per entry touching a window, sorted earliest/longest-first.
- The week view's **all-day lane** is the pattern to model bars on: CSS grid, one column per day, bars self-placed via `grid-column: start / span n`, lanes assigned by `grid-auto-flow: row dense` — no JS lane packing.
- `mitra-entry-segment` already supports `resize: 'inline'` edge handles, task checkboxes, source colors — reusable as the bar component.
- `CalendarDatesController` (day-granular buffer + recentering window + `scrollToDate`) fits a day-granular horizontal axis as-is; month view uses `{ radiusDays: 77, shiftDays: 14 }`, the timeline wants a wider radius.
- `EntryDragController` centralizes move/resize/create gestures but its geometry is `'week' | 'month'` — a `'timeline'` discriminant is new work.
- `DayDensityController` (ctrl+wheel / pinch → one CSS var, eased, cursor-anchored, persisted) is the in-house zoom pattern; the timeline needs a horizontal analogue driving a `--day-width` var instead of `--grid-min-height`.

## 4. Design decisions

### D1. The context/work split: all-day events → header, tasks → body, timed events hidden
*(Revised after the first render: the original "everything in the body" call drowned the spans under
daily-churn pills — exactly pitfall #2 from §2. The user chose the split below.)*

Entries split by their **role in planning**, not by lane availability:

- **Header context lane** — all-day events (trips, conferences, public holidays): bands under the day
  numbers, GitHub-iteration-marker style, each tinting its days down through the body (~10%
  source-color shade) — the personal analogue of GitHub's "rows are work items; calendrical context is
  axis markers" and Motion's "events constrain, tasks flow around them." Events are the *fixed* things
  the user plans around.
- **Body** — tasks only, the malleable work being placed: bars for ranged tasks, one-day pills for
  single-date tasks, packed lanes. Also the future surface for dependency arrows (task→task).
- **Hidden** — timed events (standups, 1:1s, timed multi-day offsites): at this horizon they are noise,
  not plan (Linear's timeline documents the same exclusion). They belong to the week/month views.
- **Vertical line** — the today hairline (accent dot in the header, thin line through the body).

Clock times never affect layout (day granularity); task pills still show their start time as detail.

**Future models recorded for the timed-event gap** (e.g. "Math Exam at 11:00" that people work
towards): (a) the event-with-subtasks model — an event with child tasks appears as a header
checkpoint with its children in the body (needs parent/child entries); (b) a per-entry opt-in via a
custom ICS property like `X-MITRA-TIMELINE=include`.

### D2. The header lane doubles as the future marker row
With all-day events already living on the axis, future context concepts (dependency milestones,
birthdays-style annual context) slot into the same lane rather than a new surface.

### D3. Flat packed lanes via CSS `grid-auto-flow: row dense`
One shared canvas (no groups). Non-overlapping entries share a lane; overlap pushes into new lanes — exactly the all-day-lane pattern, scaled up. Two cares:
- **Touching bars must not stack**: with exclusive end columns (`start / span n`), a bar ending where another starts occupies disjoint grid columns, so CSS dense flow handles this correctly by construction.
- **Future dependency arrows are not blocked by opaque CSS placement.** Modern CSS Anchor Positioning resolves against *rendered geometry*, not the placement mechanism: give each bar an `anchor-name`, and a connector element positioned via `anchor()` against two named anchors tracks them wherever dense flow puts them (see css-tip.com "connected circles" / "bending line" experiments: trig functions for angle/length, `shape()`/`border-shape` for elbows). The fancy parts are Chromium-only today — acceptable, Mitra already leans on native popovers + anchor positioning + container queries. Requirement honored in v0: bars and future connectors share one scroll/containment context (the single scrolling canvas).

Lane order comes from DOM order feeding dense flow; `runsIn` already sorts earliest/longest-first, which produces stable, sensible packing. This also stays compatible with future hierarchy: child rows would change what we *feed* the grid, not the placement mechanism.

### D4. Continuous horizontal zoom (`--day-width`), not discrete levels
Notion/GitHub use discrete zoom dropdowns; Mitra already has a better in-house idiom — the week view's continuous, cursor-anchored, eased density zoom. The timeline gets the horizontal analogue: a `TimelineDensityController` owning `--day-width` (rem-based), ctrl+wheel / pinch to zoom, anchored on the date under the cursor, persisted to `localStorage['Mitra.TimelineZoom']`, clamped so the viewport shows roughly between ~3 weeks and ~6 months. The axis header adapts continuously instead of per-level:
- Top row: month names (always) — sticky, GitHub-style.
- Second row: day numbers when `--day-width` is wide enough; thinning to week-start numbers below a threshold (GitHub's Month→Quarter behavior, but continuous).
- Weekend shading: initially built (GitHub's top-voted missing feature), then **removed at the user's request** — the flat canvas reads calmer with the event tints. Trivial to restore: a `data-weekend` attribute on the backdrop day cells + one background rule.

### D5. Interactions — full parity with existing views, via a `'timeline'` drag geometry
- **Move**: drag bar horizontally, whole-day steps, preserving duration (`Entry.moveStart`).
- **Resize**: `resize: 'inline'` edge handles (already built into `mitra-entry-segment`), day steps (`Entry.setEnd`), min 1 day.
- **Create**: drag on empty canvas → all-day draft spanning the dragged days (same as the all-day lane gesture).
- **Open**: tap → `mitra-entry-details` (free via the segment component).
- Vertical reordering (Notion) is meaningless under packing — skipped.

### D6. Unscheduled tray — deferred beyond v0 (deliberately)
Every surveyed tool has one, and Mitra currently renders undated entries *nowhere* — but surfacing undated entries is a **cross-view product discussion** (it concerns the week and month views just as much), not a timeline-only feature. Deferred to its own effort; the timeline layout must simply not preclude an edge panel later. The likely mechanic when it comes: Notion's phantom-bar click-to-place (dateless `EntrySegments` already exist in the layout engine).

### D7. Navigation
- `Today` button + existing `T` hotkey behavior recenters on today; timeline auto-centers on today on open (scroll-fatigue mitigation).
- Reuse `CalendarDatesController` with a wider radius (e.g. `{ radiusDays: 180, shiftDays: 30 }`) for the infinite-pan window.
- Command palette Next/Prev steps `{ months: 1 }` for the timeline.
- Header `<h1>`: show the visible range (e.g. "Jun – Sep 2026") instead of a single month — view-dependent title.
- Nice-to-have (post-v0): Notion's per-lane off-screen jump arrows; Linear's cursor date line.

### D8. Naming
`AGENTS.md` names views after the unit they strip (`Days` = week view, `Weeks` = month view). The timeline strips days horizontally but its identity is the Gantt-like canvas, not the unit — and `Days` is taken. Component: **`Timeline.ts` / `mitra-timeline`**, view key `'timeline'`.

## 5. Implementation status (as of 2026-07-10 — all of v0 built and verified)

**What exists on this branch:**
- `src/frontend/Timeline.ts` — the view: one grid with a `--day-width` track per buffered day; sticky header (months → day numbers → all-day-event context lane); backdrop (day cells with `data-date` for scroll targeting + month-start borders + today line + per-event `.shade` tints); tasks in packed body lanes. The `bars(accept)` helper projects `EntrySegments.runsIn` onto window columns for both lanes.
- `src/frontend/TimelineDensityController.ts` — continuous zoom; owns `--day-width` (= viewport ÷ zoom, zoom persisted as `Mitra.TimelineZoom`, clamped 21–180 days). All pointer math is in inline-start coordinates, so RTL only restores the sign on write.
- `src/frontend/EntryDragController.ts` — grew the `'timeline'` grid discriminant: cells snapshot from `.backdrop .day`, single-row hit-testing shared with the week branch, day-granular `editMode`, create-anywhere-below-the-header, click-to-quick-create.
- `PageCalendar.ts` — view union + select option + template branch + `L` hotkey + palette command ("Timeline View", `chart-gantt`), and a **view-dependent fetch halo** (±4 months in timeline vs ±1 elsewhere, since the viewport spans up to ~6 months).
- Registration per the known gotchas: `Timeline.styles` aggregated in `Mitra.ts` (Light-DOM), module import in `frontend/index.ts`, tag added to the `mitra-weeks, mitra-days, mitra-timeline` flex rule, select options built via `.map` (Chromium 150).
- i18n: `Timeline`, `Timeline View`, palette keywords — German added; `npm run i18n:generate` run.

**Verified** (typecheck + eslint + all 207 tests green, plus live checks): lane packing (28 seeded entries → 8 lanes before the split; adjacent bars share lanes, overlapping don't), today line, month labels, zoom easing + persistence, scroll→navigatingDate (h1 follows), click-to-open, drag-to-move (+2 days exactly, clock times preserved, ghost + dimmed source), edge-resize on all-day bars, drag-to-create with editor auto-open, `PUT` commits round-tripping, the split (4 context bands, tasks-only body, timed events hidden, correct 10% source-color shades).

**Dev-server note for this worktree:** the preview tool reads `.claude/launch.json` from the session's original project dir and port 3000 is usually taken by your own server — run the worktree's dev server with `MITRA_PORT=3100` (a launch config like `{"name": "...", "runtimeExecutable": "npm", "runtimeArgs": ["start", "--prefix", "<worktree>"], "port": 3100, "env": {"MITRA_PORT": "3100"}}` works; the backend binds `MITRA_PORT` directly, so autoPort proxying doesn't). Headless-preview quirks (rAF/ResizeObserver throttled, screenshots time out) are documented in session memory.

**Known cosmetic debt:** dev sample entries were nudged by gesture tests (Offsite/Conference/Public Holiday sit a day or two off their seeded dates in this worktree's database); bar labels clip at narrow day widths (Notion-style outside-the-bar labels would fix); the `h1` still shows the center month rather than the visible range.

**Cross-cutting conventions honored:** `t()` + `i18n:generate`, `tsgo --noEmit` + eslint, CSS per AGENTS.md (nested, logical properties, rem, container queries), no new placement math (reused tested `placeAllDay`/`resizePlacement`).

## 6. Future direction (recorded so v0 doesn't fight it)

1. **Dependencies (near future)**: arrows as CSS-anchor-positioned connector elements between bar edges (`anchor-name` per segment; `anchor()` + trig + `shape()`/`border-shape` elbows). v0 obligations honored: single containment/scroll context; per-entry stable anchor names are trivial to add to segments.
2. **Child entries**: toggle showing/hiding children under a parent — affects what feeds the grid (indented/collapsible sub-rows), not the placement mechanism.
3. **Marker lane**: holidays/context dates as top-axis labels + full-height lines (GitHub pattern), once such domain concepts exist.
4. **Grouping by source**: possible much later; explicitly out of scope now.
5. **Recurrence noise**: daily recurring tasks produce many pills at a 6-month horizon; if it becomes a problem, a "de-emphasize/hide recurring" filter is the mitigation — not a layout change.
