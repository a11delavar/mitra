import { Component, component, html, property, css, repeat, type PropertyValues, eventListener, queryAsync, styleMap } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { observeResize } from '@3mo/resize-observer'
import { type Entry, type UserTimeZone } from 'shared'
import { EntrySegments } from './EntrySegments.js'
import { EntryStore } from './EntryStore.js'
import { EntryConnections } from './EntryConnections.js'
import { CalendarDatesController } from './CalendarDatesController.js'
import { EntryDragController } from './EntryDragController.js'
import { DayDensityController } from './DayDensityController.js'
import { TimeZoneLaneController } from './TimeZoneLaneController.js'
import { getTimeZones } from './Api.js'

@component('mitra-days')
export class Days extends Component {
	@property({ type: Object }) navigatingDate = new DateTime()
	@property({ type: Array }) entries = new Array<Entry>()
	@property({ type: Boolean, reflect: true }) hideTime = false

	private readonly dates: CalendarDatesController = new CalendarDatesController(this)
	private get days(): Array<DateTime> { return this.dates.days }

	protected readonly entryDrag = new EntryDragController(this)
	protected readonly density = new DayDensityController(this)
	protected readonly zoneLane: TimeZoneLaneController = new TimeZoneLaneController(this)
	// Segments over the RENDER WINDOW, not the whole buffer — offscreen days need no slicing.
	private get segments() { return EntrySegments.of(this.entries, this.dates.window.days) }

	/** The time-axis columns: the user's additional zones first, the system zone (`undefined` — it
	 * anchors the grid) last, adjacent to the days. */
	private get timeZoneColumns(): Array<UserTimeZone | undefined> {
		return [...getTimeZones(), undefined]
	}

	// The measured width of the (content-sized) time axis, for the scroll math — the snapport excludes
	// the sticky axis, and with auto-sized zone columns the width is only known after layout.
	private timeAxisWidth = 60

	/** Whether the axis has been measured even once, i.e. whether the strip is laid out from a real
	 * width or still from the CSS approximation (see the `--time-axis-width` declaration). */
	private axisMeasured = false

	// The all-day lane sticks below the (sticky) day headers, so it needs the header row's height; the
	// scroll-padding and the scroll→date math need the axis column's laid-out width. The time-column
	// header cell stretches to both, so the `observeResize` directive on it keeps `--header-height` and
	// `--time-axis-width` in sync — firing only when it actually resizes, not per render.
	private readonly updateHeaderSize = ([entry]: ResizeObserverEntry[]) => {
		const target = entry?.target as HTMLElement | undefined
		const height = entry?.borderBoxSize?.[0]?.blockSize ?? target?.offsetHeight
		if (height) {
			this.style.setProperty('--header-height', `${height}px`)
		}
		const width = entry?.borderBoxSize?.[0]?.inlineSize ?? target?.offsetWidth
		if (width) {
			this.timeAxisWidth = width
			this.style.setProperty('--time-axis-width', `${width}px`)
			// The day tracks are a FUNCTION of this width — it decides how many whole days fit beside the
			// axis (see --_visible-days) — so the first real measurement re-fits every column under a strip
			// that `initialized` already anchored against the approximation's wider, fewer columns. Scroll
			// anchoring and the mandatory snap then settle it up to a day off the day it was told to frame,
			// and `handleScroll` reads that slip back as navigation: an arrival in this view walked the
			// calendar a day back, and with it a month whenever the day crossed one. So re-anchor, once.
			// Only the FIRST measurement: every later one is a viewport resize or the zone lane folding —
			// gestures the user is driving, which must not yank the strip.
			if (!this.axisMeasured) {
				this.axisMeasured = true
				this.anchor(this.dates.navigatingDate)
			}
			// The axis width decides which days are on screen, so the lane's depth is a function of it too.
			this.updateLaneHeight()
		}
	}

	private timeTimeout?: ReturnType<typeof setTimeout>

	protected override connected() {
		super.connected()
		// Until the first geometry-backed lane height lands, adopting one is not a change worth animating.
		this.toggleAttribute('data-lane-immediate', true)
		this.scheduleTimeUpdate()
	}

	private scheduleTimeUpdate() {
		const now = new DateTime()
		const msUntilNextMinute = 60_000 - (now.second * 1000 + now.millisecond)
		clearTimeout(this.timeTimeout)
		this.timeTimeout = setTimeout(() => {
			this.requestUpdate()
			this.scheduleTimeUpdate()
		}, msUntilNextMinute)
	}

	protected override disconnected() {
		super.disconnected()
		clearTimeout(this.timeTimeout)
	}

	@queryAsync('.now') readonly nowElement?: Promise<HTMLElement>

	protected override async initialized() {
		this.dates.navigatingDate = this.navigatingDate
		this.anchor(this.navigatingDate)
		const now = await this.nowElement
		now?.scrollIntoView({ block: 'center', behavior: 'smooth' })
	}

	/**
	 * Frame `date` as the strip's centre day — deliberately the exact INVERSE of {@link handleScroll}'s
	 * reading, so an arrival and the reading its own scroll event triggers can never disagree.
	 *
	 * `scrollIntoView({ inline: 'center' })` cannot promise that. With an EVEN number of visible days the
	 * centred box straddles two columns, which is no snap position at all: the mandatory snap breaks the
	 * tie whichever way it likes, and the reading then answers a day off the day we asked to frame —
	 * which `handleScroll` commits as navigation, and as a MONTH hop whenever that day ends a month.
	 * Deriving the position instead also reaches days outside the render window, which the element
	 * lookup in `CalendarDatesController.scrollToDate` silently skipped.
	 */
	private anchor(date: DateTime) {
		void this.updateComplete.then(() => {
			const first = this.days[0]
			const timeAxisWidth = this.hideTime ? 0 : this.timeAxisWidth
			const columnWidth = (this.scrollWidth - timeAxisWidth) / this.days.length
			if (!first || !(columnWidth > 0)) {
				return
			}
			// Consecutive local days, so the (DST-tolerant, hence rounded) day distance IS the index.
			const index = Math.round((date.dayStart.valueOf() - first.dayStart.valueOf()) / 86_400_000)
			// The column that must sit at the snapport's start for `index` to read back as its centre.
			const leadingColumn = index - Math.floor((this.clientWidth - timeAxisWidth) / 2 / columnWidth)
			const distance = Math.max(0, Math.min(leadingColumn * columnWidth, this.scrollWidth - this.clientWidth))
			// Negated in RTL, where scrollLeft counts backwards — the mirror of handleScroll's Math.abs().
			this.scrollLeft = getComputedStyle(this).direction === 'rtl' ? -distance : distance
			// The day's own cell still owns the BLOCK axis, exactly as scrollToDate left it; by now it is
			// centred inline, so `nearest` has nothing to do there and leaves the position above alone.
			this.renderRoot.querySelector(`[data-date="${date.dayStart.toISOString()}"]`)?.scrollIntoView({ block: 'center', inline: 'nearest' })
		})
	}

	protected override updated(props: PropertyValues<this>) {
		if (props.has('navigatingDate') && !this.navigatingDate.dayStart.equals(this.dates.navigatingDate.dayStart)) {
			this.dates.navigatingDate = this.navigatingDate
			this.anchor(this.navigatingDate)
		}
		this.style.setProperty('--_days-length', this.days.length.toString())
		this.style.setProperty('--_tz-count', this.timeZoneColumns.length.toString())
		// Whether there is a lane to fold at all — the rail only claims inline drags when there is.
		this.toggleAttribute('data-alternative-zones', this.timeZoneColumns.length > 1)
		if (this.hideTime) {
			// No axis to measure — let the [hideTime] rule's 0px win over a stale inline measurement. And
			// with no axis there is no ResizeObserver to release the lane's transition gate, so this view
			// simply keeps snapping; the alternative is a gate nothing ever drops.
			this.style.removeProperty('--time-axis-width')
		}
		// The lane answers to what is ON SCREEN, so a save or an SSE tick can change its height with no
		// scroll at all; scrolling itself goes through handleScroll.
		this.updateLaneHeight()
	}

	/** The window's all-day bars as (lane, day-range) triples — the placement {@link allDayTemplate}
	 * gave them, kept so {@link updateLaneHeight} can ask which lanes the visible days actually reach
	 * without re-packing anything. */
	private allDayPlacements = new Array<{ lane: number, start: number, end: number }>()

	/**
	 * Size the lane to the days ON SCREEN — the deepest lane any visible bar sits in, plus the trailing
	 * empty one. The packing itself stays window-wide (see {@link allDayTemplate}), which is the whole
	 * point: a bar's lane never changes as you scroll, so nothing ever jumps vertically — only the lane's
	 * own height follows, and only when the set of visible bars reaches a different depth.
	 *
	 * Sizing off the ±35-day render window instead, as this once did, meant a pileup weeks away from
	 * anything on screen set the height: measured against the sample calendar the lane stood 10 rows tall
	 * everywhere while the median week needed 1, and 6 of 1087 scroll positions actually wanted all 10.
	 */
	private updateLaneHeight() {
		const timeAxisWidth = this.hideTime ? 0 : this.timeAxisWidth
		const columnWidth = (this.scrollWidth - timeAxisWidth) / this.days.length
		// Pre-layout there is no viewport to ask about — the lane holds its opening lane until there is one.
		if (!(columnWidth > 0)) {
			return
		}
		// The same whole-column reading as handleScroll (see there — the snap is what makes it exact).
		const leadingColumn = Math.round(Math.abs(this.scrollLeft) / columnWidth)
		const trailingColumn = leadingColumn + Math.ceil((this.clientWidth - timeAxisWidth) / columnWidth)
		const clamp = (index: number) => Math.min(Math.max(0, index), this.days.length - 1)
		// An empty buffer leaves an empty range (first > last), which no placement can intersect.
		const first = this.days[clamp(leadingColumn)]?.dayStart.valueOf() ?? 0
		const last = this.days[clamp(trailingColumn)]?.dayStart.valueOf() ?? -1
		let deepest = -1
		for (const placement of this.allDayPlacements) {
			if (placement.start <= last && placement.end >= first) {
				deepest = Math.max(deepest, placement.lane)
			}
		}
		// +2 for the lane the deepest bar occupies and the trailing empty one (the drag-to-create target);
		// a viewport with no bars at all is just that empty lane.
		this.style.setProperty('--_all-day-rows', `${deepest + 2}`)
		// Release the transition gate on the first height derived from SETTLED geometry and from bars that
		// have actually arrived — that height is where the lane opens, not a change to animate. Both halves
		// are load-bearing (each was removed once as redundant, and each put the animation back):
		//  - the axis measurement, because the day columns are a function of it, so a depth read from the
		//    approximation is about to change again on its own — that one slid the lane open on every view
		//    switch;
		//  - a non-empty placement list, because on a cold load the strip renders before the entry fetch
		//    resolves, so the first height is a bare empty lane and the real one arrives with the data —
		//    releasing before then slid the lane open on every page load.
		// A calendar with no all-day entries at all therefore keeps snapping, which is what it should do:
		// there is only ever the one empty lane to show.
		if ((this.axisMeasured || this.hideTime) && this.allDayPlacements.length && this.hasAttribute('data-lane-immediate')) {
			requestAnimationFrame(() => this.removeAttribute('data-lane-immediate'))
		}
	}

	@eventListener('scroll')
	protected handleScroll(e: Event) {
		// Nothing read out of a strip fitted from the axis APPROXIMATION may be committed: it holds a
		// different number of day columns than the measured layout one frame later, so the date under the
		// viewport's centre is about to change — and `updateHeaderSize` re-anchors the strip the moment it
		// does. Answering now would fix the arrival at a position the re-fit was going to move.
		if (!this.axisMeasured && !this.hideTime) {
			return
		}

		const target = e.target as HTMLElement
		const timeAxisWidth = this.hideTime ? 0 : this.timeAxisWidth // measured (see updateHeaderSize)
		const colWidth = (target.scrollWidth - timeAxisWidth) / this.days.length

		// Counted from the column at the snapport's START — which the mandatory snap makes a whole column,
		// so rounding to it absorbs the sub-pixel difference between this AVERAGED pitch and the real,
		// 1/64px-quantised column positions. Reading the centre PIXEL's column instead put the answer on a
		// knife edge: the half-snapport spans a whole number of columns whenever an EVEN number of days
		// fits, so the centre lands exactly on a column boundary and that sub-pixel noise alone decided
		// which side of the floor() it fell — one day either way, per arrival, walking a month at every
		// month boundary. Math.abs() because in RTL scrollLeft counts backwards.
		// This is `anchor`'s exact inverse; the two must stay that way (see the note there).
		const leadingCol = Math.round(Math.abs(target.scrollLeft) / colWidth)
		const centerCol = leadingCol + Math.floor((target.clientWidth - timeAxisWidth) / 2 / colWidth)
		const centerDate = this.days[Math.min(Math.max(0, centerCol), this.days.length - 1)]

		if (centerDate && !centerDate.dayStart.equals(this.dates.navigatingDate.dayStart)) {
			this.dates.navigatingDate = centerDate
		}

		this.updateLaneHeight()
	}

	static override get styles() {
		return css`
			/* These three feed the atan2() in the integer-fit math below, and are registered so their
			   values are ABSOLUTIZED to px at computed-value time: Firefox rejects atan2() arguments in
			   anything but absolute units — raw container units void it, and so do rem (both verified,
			   FF 152) — while a registered <length> computes eagerly per spec. The registrations are
			   what make the math cross-browser; without them the whole track list goes invalid at
			   computed-value time and the grid collapses to auto-placed implicit columns. */
			@property --_days-strip-width {
				syntax: '<length>';
				inherits: false;
				initial-value: 0px;
			}

			/* Inherited (like any unregistered custom property would be): the all-day bar titles' sticky
			   offset reads it from inside the strip. */
			@property --time-axis-width {
				syntax: '<length>';
				inherits: true;
				initial-value: 0px;
			}

			/* The initial-value must be computationally independent, so it can't be the 10rem itself —
			   the declaration on mitra-days carries that; this 160px only covers unregistered edge cases. */
			@property --_ideal-day-width {
				syntax: '<length>';
				inherits: false;
				initial-value: 160px;
			}

			/* Registered for the same reason --zone-width is: a registered <length> can be TRANSITIONED,
			   so when the lane's depth changes (see updateLaneHeight) the height — and the timed row
			   derived from it, and the sticky label offset Day.ts reads off it — glide open instead of
			   snapping. Inherits, because Day.ts reads it from inside a day column. The initial-value
			   must be computationally independent, so it is 22px rather than the 1.375rem it mirrors;
			   that value only ever applies outside mitra-days, where nothing would have inherited. */
			@property --_all-day-lane-height {
				syntax: '<length>';
				inherits: true;
				initial-value: 22px;
			}

			/* The width of ONE alternative time-zone column, and what it is when the lane is out.
			   --zone-width is registered so it can be TRANSITIONED (and dragged to any interpolated px
			   value) — the grid tracks then glide open instead of snapping — and both inherit so the
			   labels and hour cells sitting in those tracks can fade and clip themselves against them.
			   TimeZoneLaneController reads --zone-lane-width back to clamp its drag, so the open width
			   stays a styling decision authored in one place. Same registration rationale as the lengths
			   above: an atan2() argument must absolutize to px, and 3.25rem would not. */
			@property --zone-width {
				syntax: '<length>';
				inherits: true;
				initial-value: 0px;
			}

			@property --zone-lane-width {
				syntax: '<length>';
				inherits: true;
				initial-value: 52px;
			}

			/* 1 while the viewport is too narrow to carry the alternative zones. This is the DEFAULT the
			   lane follows until the user folds or unfolds deliberately — kept here, with every other
			   breakpoint, and read back by TimeZoneLaneController rather than duplicated in JS. */
			@property --_auto-fold {
				syntax: '<number>';
				inherits: false;
				initial-value: 0;
			}

			/* mitra-days declares its own inline-size container, so this resolves against its ANCESTOR —
			   PageCalendar's main, which is width-identical to the strip. 40rem is the same threshold the
			   header's search box collapses at. */
			@container (max-width: 40rem) {
				mitra-days {
					--_auto-fold: 1;
				}
			}

			mitra-days {
				display: grid;
				/* FREE SPACE MAY NEVER REACH A ROW — that, not definiteness, is the invariant. The
				   row-spanning mitra-day subgrids hand an intrinsic row an unbounded growth limit, so under
				   the default align-content (stretch) any leftover in the container pours into the header
				   row — and STAYS there, because --header-height then measures the bloated row and the timed
				   row's formula shrinks to match, making the bloat self-consistent (a window grown while the
				   timed row lagged once wedged half the viewport of blank into the header row, and it never
				   came back). align-content: start below is what forbids it: leftover collects after the
				   last row, where nothing measures it, so the header always reports its CONTENT height and
				   the formula converges on the next frame instead of locking in.
				   - The header row is auto, hugging the taller of the zone header and the day labels rather
				     than a magic length they have to be centred in. --header-height mirrors its laid-out
				     height — measured off .timezone, which stretches to the row, so what comes back is the
				     row (see updateHeaderSize) — and feeds both the sticky offsets below and the timed row.
				   - The all-day row is EXACTLY the lane's own tracks: n × 1.375rem plus the n−1 gaps between
				     them, i.e. n × (1.375rem + 1px) − 1px. The lane then overhangs that row by 1px (see the
				     margin-block-end on .all-day) so it owns the gutter below it in both scroll states; a row
				     sized to include that pixel would stack it on top of the grid gap and the strip would sit
				     2px clear of the timed grid at scroll-top but 1px when stuck. UNCAPPED, deliberately: the
				     lane is always exactly as tall as the bars on screen need (see updateLaneHeight), which
				     is what lets it never scroll and never crop — and it may never scroll, see .all-day.
				   - The timed row is the whole-day-fit height (100% minus the rows and gaps above) times the
				     zoom (≥ 1, so the grid always fills; DayDensityController owns --_week-zoom). Still a CSS
				     formula and not a JS-measured px: the 100% re-resolves atomically in the same layout pass
				     on any resize, so only the header term can ever lag, and only by the one frame the
				     observer takes — it is a function of the header's CONTENT, which a resize barely moves.
				     The minute grids inside (.axis, .overlays, mitra-day .entries) use fr tracks, so their
				     1440 rows sum to exactly this row whatever it is — no gap below, no overflow. Not
				     minmax(…, 1fr): a flexing row can grow past what anything inside was sized against. */
				--_all-day-lane-height: calc(var(--_all-day-rows, 1) * (1.375rem + 1px) - 1px);
				/* max(0px, …) because the lane is uncapped: a viewport buried under bars can claim the whole
				   strip, and a NEGATIVE track would void the track list and collapse the grid outright. */
				--grid-min-height: max(0px, calc(var(--_week-zoom, 1) * (100% - var(--header-height, 2.75rem) - var(--_all-day-lane-height) - 2px)));
				grid-template-rows: auto var(--_all-day-lane-height) var(--grid-min-height);
				/* LOAD-BEARING, not cosmetic — see the free-space invariant above: this is what keeps the
				   auto header row out of the stretch that would bloat it beyond its content and lock in. */
				align-content: start;
				/* ONE grid owns every column: an auto track for the leading affordances, one track per
				   displayed time zone (the header labels and the axis hours adopt these same tracks via
				   subgrid, so they align by construction), then the day columns. The day tracks are
				   addressed with NEGATIVE line numbers throughout, so nothing depends on how many zone
				   tracks precede them. --time-axis-width mirrors the axis' laid-out width (measured, see
				   updateHeaderSize) for the scroll padding and the scroll→date math.

				   Every zone track is plain auto — the fold does NOT resize tracks. It clamps the CELLS
				   inside the alternative zones' columns (max-inline-size: var(--zone-width), see the
				   [data-foreign] rule below), which the auto tracks then follow down to zero and back.
				   Sizing the tracks directly was the wrong lever twice over: a fixed length padded a
				   short label like "IR" out to the full column width, and fit-content() collapsed the
				   open track to its minimum — grid only grows a track past its base size by distributing
				   FREE space, and the day buffer always overflows, so there is never any. Clamping the
				   cells keeps the base size itself content-derived (min-content == max-content for
				   unbreakable HH:MM text), which is the whole reason auto tracks hug their content here.

				   The day columns fit the viewport WHOLE: as many ideal-width (10rem) days as fit after
				   the sticky axis — never fewer than 3, so a phone still shows a multi-day span — each
				   then widened to an exact share of the leftover, so no fractional day ever shows and a
				   settled strip reads as a static N-column grid that happens to scroll. 100cqi is the
				   page's main column (PageCalendar declares the container; it and this scroller are
				   width-identical) — NOT 100%: a percentage never resolves early enough for any of this
				   math. The count divides the two lengths via tan(atan2(y, x)) — the one length-ratio
				   CSS evaluates EVERYWHERE (calc()'s typed division is Chromium-only and would void the
				   whole track list in Firefox at computed-value time, taking the layout with it) — fed
				   through the registered --_days-strip-width above so the container unit reaches atan2()
				   as plain px. The +1px/−1px pair pays for the 1px gaps: N visible days carry only N−1
				   visible gaps — the gap ahead of the snapped first day hides under the sticky axis, the
				   one after the last day is past the viewport edge.

				   The 4rem floor is LOAD-BEARING, not taste: the formula consumes the MEASURED axis width,
				   so day tracks computed from a bad transient reading could collapse to 0 — and 1092
				   collapsed tracks leave the grid free space, which stretches the auto zone tracks, which
				   makes the axis MEASURE as the whole strip, which keeps the days collapsed: a stale-
				   measurement lock-in (Firefox's first ResizeObserver delivery hit exactly this). Any
				   positive floor forbids the loop's premise — the buffer always overflows the container,
				   so the zone tracks can never absorb free space and the axis always measures its natural
				   width. */
				--_days-strip-width: 100cqi;
				--_ideal-day-width: 10rem;
				--_visible-days: max(3, round(down, tan(atan2(var(--_days-strip-width) - var(--time-axis-width), var(--_ideal-day-width))), 1));
				--_day-width: max(4rem, calc((var(--_days-strip-width) - var(--time-axis-width) + 1px) / var(--_visible-days) - 1px));
				grid-template-columns: auto repeat(var(--_tz-count, 1), auto) repeat(var(--_days-length, 1), var(--_day-width));
				gap: 1px;
				height: 100%;
				min-height: 0;
				/* How far an alternative zone's cells may open — a CEILING, not a width: the auto track
				   still hugs whatever the label and the hour actually need, so this only has to clear the
				   widest compact label a zone can carry (Intl's "GMT+3:30", for zones with no abbreviation)
				   and nothing is ever clipped when open. It doubles as the rail drag's clamp. */
				--zone-lane-width: 4rem;
				--zone-width: var(--zone-lane-width);
				/* The one property the fold animates — the cells, the tracks they size, the axis width and
				   everything measured off it all follow from it. Suspended mid-drag, where the pointer
				   already sets it per frame. Deliberately gentle and not front-loaded: a column stops
				   growing once it reaches its content width, well short of the ceiling, so a snappy curve
				   would spend the whole visible part of the motion in its first few frames. */
				/* The lane's depth is the second thing here worth animating: crossing into a dense stretch
				   changes its height (and the timed row's, which is derived from it) and a snap there reads
				   as the grid glitching mid-scroll. Quick and eased-out, because it rides a scroll gesture —
				   it must be over before the next column settles, not still travelling. */
				--_lane-height-duration: 0.18s;
				transition: --zone-width 0.3s cubic-bezier(0.3, 0, 0.4, 1), --_all-day-lane-height var(--_lane-height-duration) ease-out;

				/* The lane's FIRST height is where it starts, not a change to it: the depth is derived from
				   the strip's geometry, which isn't known until the first layout, so the opening value is
				   always the registered 22px placeholder. Left to transition, the lane visibly slid open on
				   every mount and view switch — and raced the view transition doing it. Dropped one frame
				   after the first geometry-backed height lands (see updateLaneHeight), so only real changes
				   animate. Its own property rather than transition:none, which would take the zone fold's
				   animation with it. */
				&[data-lane-immediate] {
					--_lane-height-duration: 0s;
				}
				/* Pre-measurement approximation: the anchor column plus one foldable one per alternative. */
				--time-axis-width: calc(3.75rem + (var(--_tz-count, 1) - 1) * var(--zone-width));

				/* An inline drag on the rail folds the alternative zones away or pulls them back out, so
				   the browser must not pan the strip from there — vertical scrolling stays native. Only
				   while there IS a lane to fold; otherwise the rail pans like any other column. */
				&[data-alternative-zones] :is(.timezone, .axis) {
					touch-action: pan-y;
				}

				&[data-zones-folded] {
					--zone-width: 0px;
				}

				/* The lane changes width without animating: while a pointer drives it per frame, and for the
				   one adoption of the container query's verdict on load — which is where the strip STARTS,
				   not a change to it. */
				&[data-zones-immediate] {
					transition: none;
				}

				container-type: inline-size;
				overflow: auto;
				/* Single-finger pan still scrolls the grid; two-finger pinch-zoom is disabled here so the
				   DayDensityController can own it (see its touch handlers). */
				touch-action: pan-x pan-y;
				/* Rest positions align a day's start edge to the snapport (which the padding below starts
				   past the sticky axis) — with the integer-fit columns above, a settled viewport therefore
				   always frames whole days. Inline-only, so vertical scrolling is untouched; and mandatory
				   does NOT brake a fling — engines pick the snap position nearest the fling's natural
				   endpoint (only scroll-snap-stop: always would cut momentum, so it stays unset). */
				scroll-snap-type: inline mandatory;
				scroll-padding-inline-start: var(--time-axis-width);
				scrollbar-width: none; /* Firefox */

				&::-webkit-scrollbar {
					display: none; /* Chrome/Safari */
				}

				&[hideTime] {
					--time-axis-width: 0px;
					/* No axis at all, so the zone tracks carry nothing — they must not reserve their width. */
					--zone-width: 0px;
				}

				mitra-day {
					grid-row: 1 / -1;
					grid-template-rows: subgrid;
					scroll-snap-align: start;

					.entries {
						background-color: var(--color-surface);
						grid-row: 3;
					}

					& > .header {
						background-color: var(--color-background);
					}
				}

				/* All-day lane: a horizontal strip below the headers where all-day events render as
				   column-spanning bars. Sticky below the (also-sticky) headers so it stays in view. */
				.all-day-corner {
					grid-column: 1 / calc(-1 * var(--_days-length) - 1);
					grid-row: 2;
					position: sticky;
					inset-inline-start: 0;
					/* +1px for the grid gap between the header row and this one. */
					top: var(--header-height, 2.75rem);
					z-index: 120;
					background-color: var(--color-background);
					border-block: var(--border);
					/* Overhangs the row by the grid gap below it, exactly like .all-day — otherwise the
					   corner's bottom border would part company with the day columns' gutter at scroll-top. */
					margin-block-end: -1px;
				}

				.all-day {
					grid-column: calc(-1 * var(--_days-length) - 1) / -1;
					grid-row: 2;
					position: sticky;
					top: var(--header-height, 2.75rem);
					z-index: 90;
					display: grid;
					grid-template-columns: subgrid;
					/* One 1.375rem track per occupied lane plus a trailing empty one — the drag-to-create
					   target, and the fallback row of a ghost that fits in no lane (bars, ghost included,
					   sit at their computed allDaySlots lane; see allDayTemplate). EXPLICIT tracks, never
					   auto-flow rows behind a min-block-size: the
					   parent rows fill the container exactly, so there is never free space to grow an
					   intrinsic lane row past its BASE size — for which a specified min-block-size REPLACES
					   the content-derived minimum, freezing the lane at that min while further bars overflow
					   it onto the timed grid. Explicit tracks (mirrored by the definite parent row derived
					   from the same --_all-day-rows) keep the lane and its row in lockstep with the bars. */
					/* The WINDOW's lanes, not the visible ones the box is sized to (--_all-day-rows): the box
					   height is animated and its track count cannot be, so deriving both from the same count
					   made them disagree for the length of every transition — the box shrank ahead of the
					   tracks, leaving a band of bare lane background below the last day cell, and grew behind
					   them, letting the deepest bars paint over the gutter and into the timed grid. Sized to
					   the window the content is always at least as tall as the box (the visible days are a
					   subset of the window's, so its lanes are too), so the overflow below is the only state
					   there is and clipping it is enough. Only ever whole lanes are clipped, and only lanes
					   no visible bar occupies. */
					grid-template-rows: repeat(var(--_all-day-window-rows, 1), 1.375rem);
					/* Safe — clip is not a scroll container, so the bar titles above still stick against
					   mitra-days (an auto/scroll here would capture them; see the invariant below). */
					overflow-y: clip;
					/* The gutter between the lane and the timed grid. It used to be the last pixel of the
					   lane's own background showing past the tracks; now that the cells always reach the
					   box's edge, the box has to draw it — and clipping happens inside the border, so it
					   survives every frame of the animation. */
					border-block-end: 1px solid var(--color-background);
					gap: 1px;
					align-content: start;
					background-color: var(--color-background);
					/* The strip is 1px TALLER than its row (same trick as mitra-day > .header's margin-inline),
					   so its own box covers the grid gap below and the border-block-end above is the only
					   thing between the bars and the timed grid. The lane is sticky: the row gap scrolls away
					   under it once it sticks, so a gutter drawn by the GRID is 1px at scroll-top and 0px
					   when stuck. Drawn by the LANE it travels with it — the same 1px either way. */
					margin-block-end: -1px;

					/* The day columns' surface, continued: one cell per rendered day spanning every lane, so
					   the lane reads as part of its day column and the 1px gutters between the cells continue
					   the grid's day separators up through the strip. */
					> .day {
						grid-row: 1 / -1;
						background-color: var(--color-surface);
					}

					mitra-entry-segment {
						margin-top: 0 !important;
						flex-direction: row !important;
						align-items: center !important;
						gap: 0.375rem !important;
						padding: 0 0.375rem !important;
						/* clip, not hidden: hidden makes the bar a scroll container, which would capture the
						   sticky heading below and turn it into a no-op. clip crops identically without one. */
						overflow: clip !important;

						> .heading {
							/* Shrink-to-fit, not flex: 1 — the sticky heading needs slack inside the bar to
							   slide through; shrink still caps a long title at the bar's width, ellipsing as
							   before (the heading's own overflow keeps its automatic minimum size at 0). */
							flex: 0 1 auto !important;
							white-space: nowrap !important;
							overflow: hidden !important;
							text-overflow: ellipsis !important;
							/* A multi-day bar scrolled partly behind the time axis keeps its title in view:
							   sticky against the horizontal scroller (mitra-days), offset just past the sticky
							   axis, and constrained to the bar's own box — so the title rides the scroll until
							   the bar's trailing edge pushes it out. The measured --time-axis-width keeps the
							   offset correct for any number of zone columns (and 0px under [hideTime]); the
							   0.375rem matches the bar's inline padding, so sticking begins seamlessly the
							   moment the bar's edge passes under the axis. */
							position: sticky;
							inset-inline-start: calc(var(--time-axis-width, 0px) + 0.375rem);
						}
					}
				}

				& > .time {
					display: contents;

					/* Together the rail: the sticky chrome the density wheel and the fold drag both act on,
					   so neither gesture may start by selecting an hour label. */
					.timezone, .axis {
						user-select: none;
					}

					.timezone {
						grid-column: 1 / calc(-1 * var(--_days-length) - 1);
						grid-row: 1;
						/* The zone labels sit on the parent's own zone tracks (through the header
						   component's nested subgrid), exactly like the axis hours below them. */
						display: grid;
						grid-template-columns: subgrid;
						position: sticky;
						top: 0;
						inset-inline-start: 0;
						z-index: 200;
						background-color: var(--color-background);
						padding: 0.375rem 0;
					}

					.axis {
						grid-column: 1 / calc(-1 * var(--_days-length) - 1);
						grid-row: 3;
						display: grid;
						/* One fr track per minute — NEVER a repeated px/percentage length. Chromium quantizes
						   each track to 1/64px, so 1440 × a quantized per-minute height drifts up to ~22px
						   from the row and JUMPS in 22.5px steps whenever the zoom crosses a quantization
						   boundary (a gap below 23:00 that shifts as the density changes). fr is the one
						   sizing mode where the browser distributes the remainder so the tracks sum to the
						   container exactly. minmax(0, 1fr) so content can't inflate a minute row. */
						grid-template-rows: repeat(1440, minmax(0, 1fr));
						/* The same parent tracks as the header labels — aligned by construction. */
						grid-template-columns: subgrid;
						position: sticky;
						inset-inline-start: 0;
						z-index: 110;
						background-color: var(--color-background);

						.now {
							grid-column: -2;
							justify-self: end;
							align-self: start;
							transform: translateY(-50%);
							background-color: var(--color-accent);
							color: var(--color-accent-text);
							padding: 0.125rem 0.25rem;
							border-radius: var(--border-radius);
							font-size: 0.65rem;
							font-weight: 600;
							z-index: 10;
						}

						.hour {
							font-size: 0.65rem;
							font-weight: 500;
							height: min-content;
							color: var(--color-text-muted);
							text-align: end;
							padding-inline-end: 0.5rem;
							transform: translateY(-50%);

							/* An additional zone's hours read as secondary next to the system column's — and
							   fade out with their column as it folds, rather than being clipped mid-glyph.
							   tan(atan2(y, x)) is y/x, the one length ratio every engine evaluates (see the
							   day-fit math above), which is also why both operands are registered lengths. */
							&[data-foreign] {
								opacity: calc(0.55 * clamp(0, tan(atan2(var(--zone-width), var(--zone-lane-width))), 1));
								/* THIS is what folds — the cell, not its track (see the track list above). A
								   definite max-inline-size clamps the cell's min-content contribution as well as
								   its max-content one, which is what lets the auto track follow it all the way
								   down to zero and back up to exactly the content width. Clipped, because the
								   label has to be croppable on the way; the padding folds with it, since padding
								   alone would hold the column 0.5rem open; and border-box, so the ceiling means
								   the WHOLE cell — on content-box the padding sits outside it and every
								   part-open column reads 0.5rem too wide. */
								box-sizing: border-box;
								max-inline-size: var(--zone-width);
								overflow: clip;
								padding-inline-end: min(0.5rem, var(--zone-width));
							}
						}
					}

					.overlays {
						--border: 1px solid var(--color-background);
						grid-column: calc(-1 * var(--_days-length) - 1) / -1;
						grid-row: 3;
						display: grid;
						/* fr, not a repeated length — see .axis for why. */
						grid-template-rows: repeat(1440, minmax(0, 1fr));
						grid-template-columns: subgrid;

						.hour {
							border-top: var(--border);
							grid-column: 1 / -1;
							z-index: 1;
						}

						.now {
							grid-column: 1 / -1;
							display: grid;
							grid-template-columns: subgrid;
							align-items: center;
							z-index: 10;
							align-self: start;
							transform: translateY(-50%);

							.track {
								grid-column: 1 / -1;
								grid-row: 1;
								height: 1px;
								background-color: color-mix(in srgb, var(--color-accent) 40%, transparent);
							}

							.line {
								grid-row: 1;
								height: 2px;
								background-color: var(--color-accent);
								position: relative;
								overflow: visible;

								&::before, &::after {
									content: '';
									position: absolute;
									top: 50%;
									width: 9px;
									height: 9px;
									border-radius: 50%;
									background-color: var(--color-accent);
								}

								&::before {
									inset-inline-start: 0;
									transform: translate(-50%, -50%);
								}

								&::after {
									inset-inline-end: 0;
									transform: translate(50%, -50%);
								}
							}
						}
					}
				}
			}
		`
	}

	protected override createRenderRoot() { return this }

	protected override get template() {
		return html`
			${this.timeTemplate}
			${this.allDayTemplate}
			${this.dateTemplate}
			${this.connectionsTemplate}
		`
	}

	private get connectionsTemplate() {
		// LAST child on purpose: same z-index (1) as the hour lines, so tree order paints the
		// connectors above them — while the chips (z 2) stay above the connectors (see EntryConnections).
		return !EntryConnections.isEnabledFor('week') ? html.nothing : html`
			<mitra-entry-connections .entries=${this.entries} .range=${this.dates.window}></mitra-entry-connections>
		`
	}

	private get allDayTemplate() {
		// Bars render (and clip) against the window — a run's parts beyond it are offscreen by definition.
		const { days, offset } = this.dates.window
		const first = days[0]
		const last = days.at(-1)
		if (!first || !last) {
			return html.nothing
		}
		// The lane always renders (even with no all-day events) so it stays a drag target for creating one.
		const runs = this.segments.runsIn(first, last, entry => !!entry.allDay)
		const slots = this.segments.allDaySlots
		// The lanes the window's REAL bars occupy. Packed over the WHOLE window, not the visible days, so a
		// bar's lane is a fact about the bar and never changes as you scroll — nothing jumps vertically;
		// only the lane's HEIGHT follows the viewport (see updateLaneHeight). A move's ghost sits at the
		// lane it will land in (see EntrySegments.slots) but never claims a lane of its own: on release its
		// source's lane frees up, so a ghost that fits nowhere rides the trailing empty lane instead.
		const laneCount = runs.reduce((count, segment) => EntryStore.isPreview(segment.entry) ? count : Math.max(count, (slots.get(segment.entry) ?? -1) + 1), 0)
		const laneOf = (entry: Entry) => Math.min(slots.get(entry) ?? laneCount, laneCount)
		// What updateLaneHeight reads back to size the lane — the real bars only, so a mid-drag ghost can't
		// grow the lane under the pointer dragging it.
		this.allDayPlacements = runs
			.filter(segment => !EntryStore.isPreview(segment.entry))
			.map(segment => ({ lane: laneOf(segment.entry), start: segment.dayValue!, end: segment.runEnd.dayValue! }))
		// The lane's TRACKS (see the .all-day rule) — every lane the window holds, so the content the
		// animated box slides over is stable and always taller than it.
		this.style.setProperty('--_all-day-window-rows', `${laneCount + 1}`)
		this.updateLaneHeight()
		// Built once per render so each bar's column is an O(1) numeric lookup (segments cache their dayValue).
		const lastValue = last.dayStart.valueOf()
		const columnByDay = new Map(days.map((day, index) => [day.dayStart.valueOf(), offset + index]))
		const columnOf = (dayValue?: number) => columnByDay.get(dayValue ?? -1) ?? 0
		return html`
			${/* data-chrome (here and below): the grid's frame — kept above the entries a view transition
			   animates, see calendarTransition.ts. */''}
			<div class="all-day-corner" data-chrome></div>
			<div class="all-day">
				${days.map((_, index) => html`<div class="day" style="grid-column: ${offset + index + 1};"></div>`)}
				${repeat(runs, segment => segment.entry, segment => {
					const startColumn = columnOf(segment.dayValue)
					const clippedRight = segment.runEnd.dayValue! > lastValue
					const endColumn = clippedRight ? offset + days.length - 1 : columnOf(segment.runEnd.dayValue)
					return html`
						<mitra-entry-segment
							style=${styleMap({ gridColumn: `${startColumn + 1} / span ${endColumn - startColumn + 1}`, gridRow: `${laneOf(segment.entry) + 1}` })}
							resize="inline"
							?has-previous=${segment.hasPrevious}
							?has-next=${clippedRight}
							.segment=${segment}
						></mitra-entry-segment>
					`
				})}
			</div>
		`
	}

	private get timeTemplate() {
		if (this.hideTime) {
			return html.nothing
		}

		const today = new DateTime()
		// The navigating date, not the buffer start: an additional zone's offset must be the one in
		// effect for the VIEWED week (DST!), and the buffer start can be a year and a half away.
		const reference = this.dates.navigatingDate
		const todayValue = today.dayStart.valueOf()
		const todayIndex = this.days.findIndex(d => d.dayStart.valueOf() === todayValue)
		const currentMinute = today.hour * 60 + today.minute
		const currentTimeString = today.format({ hour: '2-digit', minute: '2-digit', hour12: false })
		const zones = this.timeZoneColumns

		return html`
			<div class="time">
				<div class="timezone" data-chrome ${observeResize(this.updateHeaderSize)}>
					<mitra-time-zone-header ?folded=${this.zoneLane.folded}
						@change=${() => this.requestUpdate()}
						@fold=${(e: CustomEvent<boolean>) => this.zoneLane.setFolded(e.detail)}
					></mitra-time-zone-header>
				</div>

				<div class="axis" data-chrome>
					${zones.map((zone, column) => Array.from({ length: reference.hoursInDay }).map((_, i) => {
						// Blank the label the now-chip is about to overlay — only in its (the system) column.
						const isCloseToNow = !zone && todayIndex !== -1 && Math.abs(i * 60 - currentMinute) < 15
						const timeText = (i === 0 || isCloseToNow) ? '' : reference.with({ hour: i, minute: 0, second: 0, millisecond: 0 })
							.format({ hour: '2-digit', minute: '2-digit', hour12: false, ...(!zone ? {} : { timeZone: zone.id }) })
						return html`
							<div class="hour" style="grid-row: ${i * 60 + 1}; grid-column: ${column + 2};" ?data-foreign=${!!zone}>
								${timeText}
							</div>
						`
					}))}
					${todayIndex === -1 ? html.nothing : html`
						<div class="now" style="grid-row: ${currentMinute + 1};">${currentTimeString}</div>
					`}
				</div>

				<div class="overlays">
					${Array.from({ length: reference.hoursInDay }).map((_, i) => {
						if (i === 0) return html.nothing
						return html`<div class="hour" style="grid-row: ${i * 60 + 1};"></div>`
					})}

					${todayIndex === -1 ? html.nothing : html`
						<div class="now" style="grid-row: ${currentMinute + 1};">
							<div class="track"></div>
							<div class="line" style="grid-column: ${todayIndex + 1};"></div>
						</div>
					`}
				</div>
			</div>
		`
	}

	private get dateTemplate() {
		const todayValue = new DateTime().dayStart.valueOf()
		// Only the window gets real day trees; every other buffer day is just its (empty) grid track —
		// the columns are placed explicitly, so scroll geometry doesn't depend on what's rendered.
		const { days, offset } = this.dates.window
		// Day tracks start after the "+" track and the zone tracks (see the grid-template comment).
		const firstDayColumn = this.timeZoneColumns.length + 2
		return html`
			${repeat(days, day => day.dayStart.toISOString(), (day, index) => html`
				${/* Its header titles the column here (sticky at the top of the scroller), rather than
				   printing a numeral inside the cell as the month and year grids do — so it belongs to
				   the frame a view transition must keep above the entries. */''}
				<mitra-day
					data-date=${day.dayStart.toISOString()}
					column-header
					style="grid-column: ${firstDayColumn + offset + index};"
					.date=${day}
					.entries=${this.segments.timedOn(day)}
					?today=${day.dayStart.valueOf() === todayValue}
				></mitra-day>
			`)}
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-days': Days
	}
}
