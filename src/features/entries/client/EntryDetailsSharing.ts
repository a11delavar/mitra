import { Component, component, html, css, property, event } from '@a11d/lit'
import { Transparency, Visibility, type Entry } from '../Entry.js'
import { getCapabilities } from '../../../infrastructure/http/Api.js'
import { EntryStore } from './EntryStore.js'

// Resolved per render, like the task-status labels: `t` binds the current language at call time and
// must never run before Mitra assigns the global.
function transparencyLabel(transparency: Transparency): string {
	switch (transparency) {
		case Transparency.Busy: return t('Busy')
		case Transparency.Free: return t('Free')
	}
}

// `null` is the pickable "let the calendar decide" (see Entry.visibility) — a real option, so it has
// a label of its own rather than an empty row.
function visibilityLabel(visibility: Visibility | null): string {
	switch (visibility) {
		case Visibility.Public: return t('Public')
		case Visibility.Private: return t('Private')
		case Visibility.Confidential: return t('Confidential')
		default: return t('Default visibility')
	}
}

/**
 * How the entry appears to everyone ELSE, split out of the entry-details popover like the date/time
 * editor beside it: whether its time counts as busy (RFC 5545 TRANSP) and who may read it (RFC 5545
 * CLASS) — the pair Google Calendar and Notion Calendar both put on one line behind an eye.
 *
 * Deliberately TWO fields sharing one glyph, the shape the date and time lines already use: they are
 * independent facts, and only the first one is event-only — a task has no free/busy contribution to
 * make (see Entry's `type` setter), but it can still be private. It mutates the entry in place and
 * fires `change`; the host persists.
 *
 * Nothing about this reaches the grid. A distinct chip is the obvious idiom and the wrong move here:
 * that look belongs to the availability frames being designed, whose shading sits BEHIND the chip
 * plane precisely so the chip plane stays uniform — and Notion Calendar draws free events exactly
 * like busy ones for the same reason.
 */
@component('mitra-entry-details-sharing')
export class EntryDetailsSharing extends Component {
	@property({ type: Object }) entry!: Entry

	override role = 'listitem'

	/** Fired after a pick mutates the entry in place; the host persists and refreshes. */
	@event() readonly change!: EventDispatcher

	// Subscribe to the store so a re-render fires when the entry mutates in place — notably a source
	// migration, which changes `entry.sourceId` (and thus the provider's capabilities) on the SAME
	// instance, so the incoming `@property` reference is unchanged and lit wouldn't re-render on its
	// own. That's what hides these fields once the entry moves to a provider that can't hold them.
	readonly store = new EntryStore(this)

	protected override createRenderRoot() { return this }

	private get capabilities() {
		return getCapabilities(this.entry.sourceId)
	}

	/** Free/busy is an EVENT's contribution to a free/busy answer; RFC 5545 gives VTODO no TRANSP. */
	private get showsTransparency() {
		return EntryDetailsSharing.showsTransparency(this.entry)
	}

	private static showsTransparency(entry: Entry) {
		return !entry.type.isTask && getCapabilities(entry.sourceId).transparency
	}

	/** Whether this row has anything to say about `entry` — asked by the HOST before it places the
	 * element, so an empty row never takes a separator with it (see EventDetails' groups). The
	 * template below guards on this same answer rather than a copy of it. */
	static applies(entry: Entry) {
		return EntryDetailsSharing.showsTransparency(entry) || !!getCapabilities(entry.sourceId).visibility
	}

	private commit() {
		this.requestUpdate()
		this.change.dispatch()
	}

	private readonly handleTransparencyChange = (e: Event) => {
		this.entry.transparency = (e.target as HTMLSelectElement).value as Transparency
		this.commit()
	}

	private readonly handleVisibilityChange = (e: Event) => {
		// The empty value is the default row: `null`, the stored form of "let the calendar decide".
		this.entry.visibility = ((e.target as HTMLSelectElement).value || null) as Visibility | null
		this.commit()
	}

	static override get styles() {
		return css`
			mitra-entry-details-sharing {
				/* The popover's two columns, like every other row of the list: a leading glyph and its
				   content (see EventDetails' <ul>). */
				display: grid;
				grid-template-columns: subgrid;
				grid-column: 1 / -1;
				align-items: center;

				> mitra-icon {
					grid-column: 1;
					font-size: 0.87rem;
					color: var(--color-text-muted);
					flex-shrink: 0;
				}

				/* Two controls on one line, so — exactly like the date and time pairs — the glyph stays
				   OUT in the gutter and each select is its own field. One box around the pair would
				   claim they are one setting, and they are two. */
				> .choices {
					grid-column: 2 / -1;
					display: flex;
					align-items: center;
					gap: 0.25rem;
					min-width: 0;

					> .field {
						/* Equal halves: a zero basis splits the track by the FLEX RATIO rather than by
						   content, so the pair reads as two peers whatever either value says — "Busy" is
						   one short word and "Default visibility" two long ones, and in German the second
						   is one very long one. A single field (a task, which has no free/busy to offer)
						   simply takes the whole row. */
						flex: 1 1 0;
						/* Tighter than a full-row field's, so the pair's borders stay clear of the gutter
						   glyph while the first value still sits on the content line. Declared on the
						   fields THEMSELVES: .field sets its own default, which would out-cascade a value
						   inherited from this container. */
						--field-padding-inline: 0.25rem;
						display: flex;
						align-items: center;
						min-width: 0;

						/* Net-zero against that padding (first), and the row's usual trailing bleed (last)
						   — so the pair spans exactly the row every other field does. */
						&:first-child { margin-inline-start: calc(-1 * var(--field-padding-inline)); }
						&:last-child { margin-inline-end: -0.25rem; }

						/* The control fills the half it was given, so each chevron rides its OWN field's
						   trailing edge and the whole half is the target — the deal the zone row strikes. */
						> select {
							flex: 1;
							min-width: 0;

							/* A value longer than its half ellipsizes rather than shoving the chevron out of
							   the box: the halves are fixed now, so the text is what has to give. */
							selectedcontent {
								overflow: hidden;
								text-overflow: ellipsis;
								white-space: nowrap;
							}
						}
					}
				}
			}
		`
	}

	protected override get template() {
		if (!EntryDetailsSharing.applies(this.entry)) {
			return html.nothing
		}
		// An entry carrying no TRANSP is busy — that IS the RFC's default, so the select shows Busy and
		// picking it changes nothing rather than writing a line that says what absence already said.
		const transparency = this.entry.transparency ?? Transparency.Busy
		return html`
			<mitra-icon icon="eye"></mitra-icon>
			<div class="choices">
				${!this.showsTransparency ? html.nothing : html`
					<span class="transparency field">
						<select aria-label=${t('Show as busy or free')} title=${t('Show as busy or free')} @change=${this.handleTransparencyChange}>
							<button>
								<selectedcontent></selectedcontent>
							</button>
							${/* Mapped, never inline <option> literals: an inline option carrying a lit marker is
							    present when lit sets the template's innerHTML, and Chromium clones it into
							    <selectedcontent> right then — duplicating the marker and corrupting lit's part
							    indices (see PageCalendar). */''}
							${Object.values(Transparency).map(value => html`
								<option value=${value} ?selected=${value === transparency}>${transparencyLabel(value)}</option>
							`)}
						</select>
					</span>
				`}
				${!this.capabilities.visibility ? html.nothing : html`
					${/* No choice made yet, so the row reads as a placeholder rather than a value — the same
					    voice an unset Repeat or a viewer's-own time zone speaks. */''}
					<span class="visibility field">
						<select ?data-placeholder=${!this.entry.visibility} aria-label=${t('Visibility')} title=${t('Visibility')} @change=${this.handleVisibilityChange}>
							<button>
								<selectedcontent></selectedcontent>
							</button>
							${[null, ...Object.values(Visibility)].map(value => html`
								<option value=${value ?? ''} ?selected=${value === this.entry.visibility}>${visibilityLabel(value)}</option>
							`)}
						</select>
					</span>
				`}
			</div>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-entry-details-sharing': EntryDetailsSharing
	}
}
