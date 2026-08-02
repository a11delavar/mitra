import { Component, component, html, css, property, state, event, query } from '@a11d/lit'
import { Color, ParticipantRole, ParticipantStatus, Participants, type Entry, type Participant } from 'shared'
import { getIntegrationFor } from '../Api.js'
import { contrastColor } from './contrastColor.js'

/**
 * The "Participants" control for the entry editor: a header with the invitee count, the reply summary
 * ("3 yes, 3 awaiting") and the row's two actions — a batch menu (e-mail everyone, copy all e-mails,
 * mark all required/optional, remove all) and an add button — followed by the participants themselves
 * and, past the fold, an expander that previews the faces it hides.
 *
 * The two trailing buttons are the shape the REMINDERS row already uses: a ⋯ menu and a `+` that is the
 * one way to add, whether the list is empty or long. It is the one field whose menu does NOT hang off
 * the field box: a field many rows tall would open it nowhere near the button that summoned it, so the
 * button names its own anchor and the field convention yields through `--field-anchor` (field.css.ts).
 *
 * All list behavior lives on the domain (`Entry.invite`/`setParticipantRole`/`removeParticipant`/
 * `markAllParticipants`/`clearParticipants` and the `Participants` collection) — this component only
 * renders and forwards. Every mutation follows iTIP (RFC 5546): only the entry's ORGANIZER may change
 * the list (`Entry.canManageParticipants`), everyone else sees the batch actions disabled and no
 * per-person ones at all — the backend enforces the same rule. The organizer is never one of the
 * managed rows: they own the list rather than sit on it, so they have no role to flip and no seat to
 * lose (`Participants.invitee`). Fires `change` after a mutation; the host persists.
 */
@component('mitra-participants-field')
export class ParticipantsField extends Component {
	/** Collapse to this many rows (plus the expander) until expanded. */
	private static readonly collapsedRows = 4

	/** How many faces the expander previews — as many as fit the avatar column without widening it. */
	private static readonly previewedFaces = 2

	@property({
		type: Object,
		// The popover got reused for another entry: close the menu, collapse the list, drop the add box.
		updated(this: ParticipantsField) { this.menu?.hidePopover(); this.expanded = false; this.adding = false },
	}) entry!: Entry

	/** Fired after the entry's participant list changed, so the host can persist. */
	@event() readonly change!: EventDispatcher

	@state() private expanded = false

	/** Whether the add box is out. The `+` button summons it; it retreats when left empty. */
	@state() private adding = false

	protected override createRenderRoot() { return this }

	@query('menu[popover]') private readonly menu?: HTMLElement

	@query('input.add') private readonly addInput?: HTMLInputElement

	private get participants(): Participants | null {
		return this.entry.participantList
	}

	/** Organizer first — like every calendar UI; the rest keep their stored order. */
	private get displayed(): Array<Participant> {
		return this.participants?.organizerFirst ?? []
	}

	private get canManage() {
		return this.entry.canManageParticipants
	}

	/** The account's own address for this entry's integration — who "I" am when inviting. */
	private get ownAddress(): string | undefined {
		return getIntegrationFor(this.entry.sourceId)?.addresses?.[0]
	}

	private changed() {
		this.requestUpdate()
		this.change.dispatch()
	}

	/** Invite every e-mail in the input (commas/whitespace separate several) — the entry owns the rules. */
	private add(input: HTMLInputElement) {
		if (this.entry.invite(input.value.split(/[\s,;]+/), this.ownAddress)) {
			input.value = ''
			this.changed()
		}
	}

	private readonly copyEmails = () => {
		navigator.clipboard.writeText(this.participants?.emails ?? '').catch(() => void 0)
		this.menu?.hidePopover()
	}

	private markAll(role: ParticipantRole) {
		this.entry.markAllParticipants(role)
		this.changed()
		this.menu?.hidePopover()
	}

	private readonly removeAll = () => {
		this.entry.clearParticipants()
		this.changed()
		this.menu?.hidePopover()
	}

	private readonly toggleMenu = () => {
		this.menu?.togglePopover()
	}

	/** Bring out the add box and put the caret in it — the `+` is a summons, not a mode. */
	private readonly startAdding = async () => {
		this.adding = true
		await this.updateComplete
		this.addInput?.focus()
	}

	private toggleRole(participant: Participant) {
		this.entry.setParticipantRole(participant.email, participant.role === ParticipantRole.Optional ? ParticipantRole.Required : ParticipantRole.Optional)
		this.changed()
	}

	private uninvite(participant: Participant) {
		this.entry.removeParticipant(participant.email)
		this.changed()
	}

	/**
	 * The reply marks. All three are BARE strokes — the badge is already a disc, so any glyph that
	 * brings its own ring (the question mark in a circle this used to wear) collapses into a blob at
	 * 8px. A dash is the most legible shape there is at that size and reads as "neither yes nor no"
	 * between the tick and the cross; yellow puts it on the same traffic light as them, where grey
	 * only said "nothing to see".
	 */
	private static readonly statusBadges = new Map<ParticipantStatus, { icon: string, color: string }>([
		[ParticipantStatus.Accepted, { icon: 'check', color: Color.Green }],
		[ParticipantStatus.Declined, { icon: 'x', color: Color.Red }],
		[ParticipantStatus.Tentative, { icon: 'minus', color: Color.Yellow }],
	])


	static override get styles() {
		return css`
			mitra-participants-field {
				grid-column: 2;
				min-width: 0;
				display: flex;
				flex-direction: column;
				align-items: stretch;
				/* An EMPTY field is one line — the add box — inside a row that stands a full control
				   tall, so it has to sit on that row's centre line like every other empty row's
				   placeholder (it used to hang from the top). Once there are participants the content
				   outgrows the row and this stops applying on its own. */
				justify-content: center;
				gap: 0.375rem;
				/* A one-line field centres its label in the control height, which leaves exactly this
				   much air above and below it (the same expression a textarea uses inside a field). A
				   field that grows past one line has to SPEND that air as padding instead, or its first
				   and last rows sit flush against the box while every neighbouring row breathes. It is
				   also what keeps the gutter glyph on the first line: field.css.ts pins the icon to the
				   centre of a control-height first row, which is where this padding puts that line. */
				padding-block: calc((var(--control-height) - 2px - 1lh) / 2);
				/* Confine the menu's anchor to this field, so one name serves every instance — the same
				   trick field.css.ts plays with --field. */
				anchor-scope: --participants-menu;

				/* ONE set of controls, not two that happen to resemble each other: the header's pair and
				   every row's actions share this size, this ink and this swallowed padding (which is the
				   exact counterpart of the button's own, so no row grows past a line's height), and each
				   group holds its members the same 0.25rem apart. */
				mitra-icon-button {
					color: var(--color-text-muted);
					font-size: 0.87rem;
					margin-block: -0.25rem;
				}

				> header {
					display: flex;
					align-items: center;
					gap: 0.25rem;

					> .count {
						flex: 1;
						min-width: 0;
						display: flex;
						flex-direction: column;
						gap: 0.125rem;

						> .summary {
							font-size: 0.6875rem;
							color: var(--color-text-muted);
						}
					}

					/* The menu hangs off THIS button rather than the field (see the class note and
					   field.css.ts): the field box spans every participant row, so the shared rule
					   would open the menu against a block the button only caps. */
					> .menu-button {
						anchor-name: --participants-menu;
					}
				}

				/* Not a child selector: the rows past the fold live one level down, inside the
				   expander's details content. */
				.person {
					display: flex;
					align-items: center;
					gap: 0.5rem;

					> .avatar {
						position: relative;
						flex-shrink: 0;
						width: 1.5rem;
						height: 1.5rem;
						border-radius: 50%;
						display: flex;
						align-items: center;
						justify-content: center;
						font-size: 0.6875rem;
						font-weight: 650;
						background: color-mix(in srgb, var(--participant-color) 35%, var(--color-surface));
						color: color-mix(in srgb, var(--participant-color) 60%, var(--color-text));

						> .reply {
							position: absolute;
							inset-block-end: -0.125rem;
							inset-inline-end: -0.125rem;
							width: 0.75rem;
							height: 0.75rem;
							border-radius: 50%;
							display: flex;
							align-items: center;
							justify-content: center;
							background: var(--reply-color);
							/* Every reply colour is a light pastel, so a white glyph washes out on it —
							   let the UA pick the readable ink instead of hard-coding one (black today
							   for all three, and still right if a badge colour ever darkens). */
							color: ${contrastColor('var(--reply-color)')};
							outline: 2px solid var(--color-surface);

							> mitra-icon {
								font-size: 0.5rem;
								/* Lucide's default hairline is drawn for a 1rem glyph; at half that it
								   thins to nothing, so the mark is redrawn heavier to survive the badge.
								   4 is where the tick reads at a glance without the stroke closing up
								   its own corner — past that the marks turn to blobs. */
								--mitra-icon-stroke-width: 4;
							}
						}
					}

					> .who {
						flex: 1;
						min-width: 0;
						display: flex;
						flex-direction: column;

						/* The e-mail is the identity — selectable (and copyable) by design. */
						> .email {
							user-select: text;
							cursor: text;
							overflow: hidden;
							text-overflow: ellipsis;
							white-space: nowrap;
						}

						> .detail {
							font-size: 0.6875rem;
							color: var(--color-text-muted);
							overflow: hidden;
							text-overflow: ellipsis;
							white-space: nowrap;
						}
					}

					/* Per-person actions ride the row's trailing edge as a GROUP — the pair sits as close
					   together as the header's does, while the row's own wider gap keeps them off the
					   address. They stay out of sight until the row is hovered or tabbed into, the same
					   restraint the reminders row gives its remove button. A touch screen has no hover
					   to reveal them with, so there they simply stand: unlike the reminders row, this is
					   the ONLY way to uninvite someone. */
					> .actions {
						display: flex;
						align-items: center;
						gap: 0.25rem;
						opacity: 0;
						transition: opacity 0.15s ease;
					}

					&:hover > .actions,
					> .actions:focus-within {
						opacity: 1;
					}

					@media (pointer: coarse) {
						> .actions {
							opacity: 1;
						}
					}
				}

				/* The overflow rows live in a <details>, so the reveal is pure CSS: interpolate-size
				   makes an auto block-size interpolable and the details content grows from nothing to
				   its natural height — the popover simply follows it, the same mechanic the release
				   notes use in the About dialog. The summary is ordered LAST so the toggle stays at
				   the foot of the list in both states instead of splitting the shown rows from the
				   revealed ones, and it slides down with the growth for free. */
				> details {
					interpolate-size: allow-keywords;
					display: flex;
					flex-direction: column;

					&::details-content {
						block-size: 0;
						opacity: 0;
						overflow: hidden;
						transition: block-size 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease, content-visibility 0.3s allow-discrete;
					}

					&[open]::details-content {
						block-size: auto;
						opacity: 1;
					}

					/* The row gap BELOW the revealed rows has to live inside the animated box, or the
					   collapsed list carries a dent under it — and as a margin, not padding, since
					   padding survives a zero block-size while a clipped child margin goes with it.
					   Above them there is nothing to add: that gap is the flex gap the field already
					   puts between the last folded-in row and this expander. */
					> .rest {
						display: flex;
						flex-direction: column;
						gap: 0.375rem;
						margin-block-end: 0.375rem;
					}

					/* The summary wears .person, so it needs no display of its own — the class already gives
					   it the row's geometry, which is the whole point: the fold reads as one more line of
					   the list. That also drops the UA's list-item display, and the disclosure triangle
					   with it. No all:unset here, or it would fight the class it borrows. */
					> summary {
						order: 1;
						cursor: pointer;
						list-style: none;
						/* The row's ink, which its parts inherit — so hovering only has to lift THAT.
						   A background band would be the loudest thing in a field made of quiet rows,
						   and it would be the only row wearing one; brightening the label says the same
						   thing without redrawing the row. */
						color: var(--color-text-muted);
						transition: color 0.15s ease;

						&:hover {
							color: var(--color-text);
						}

						/* The two avatar-column stand-ins. Only one is ever up: the faces answer "who is
						   behind this?", and once they are on screen the question is spent, so a chevron
						   takes over as the way back. */
						> :is(.faces, .chevron) {
							flex-shrink: 0;
							inline-size: 1.5rem;
							block-size: 1.5rem;
							display: flex;
							align-items: center;
						}

						> .chevron {
							justify-content: center;
							border-radius: 50%;
							font-size: 0.8rem;
							background: color-mix(in srgb, var(--color-text) 8%, transparent);
						}

						/* Sized and overlapped to fit the avatar column EXACTLY (0.95 + 0.55 = 1.5rem):
						   the rail must not shift for this one row, which is what caps the preview at
						   two faces however many are folded away — the label carries the real count. */
						> .faces > .face {
							flex-shrink: 0;
							inline-size: 0.95rem;
							block-size: 0.95rem;
							border-radius: 50%;
							display: flex;
							align-items: center;
							justify-content: center;
							font-size: 0.45rem;
							font-weight: 650;
							outline: 2px solid var(--color-surface);
							background: color-mix(in srgb, var(--participant-color) 35%, var(--color-surface));
							color: color-mix(in srgb, var(--participant-color) 60%, var(--color-text));

							& + .face {
								margin-inline-start: -0.4rem;
							}
						}

						> .label {
							flex: 1;
							min-width: 0;
							font-size: 0.8125rem;
							overflow: hidden;
							text-overflow: ellipsis;
							white-space: nowrap;
						}

						> :is(.chevron, .fewer) {
							display: none;
						}
					}

					&[open] > summary {
						> :is(.faces, .more) {
							display: none;
						}

						> .chevron {
							display: flex;
						}

						> .fewer {
							display: block;
						}
					}
				}

				/* The add box itself needs no rule: inside a field the input is already bare and
				   padding-less (field.css.ts), so its placeholder sits on the content line as it is.
				   Its ROW does — the empty seat waiting for the face the address will earn, dashed
				   because nobody is in it yet. */
				> .adding {
					> .seat {
						flex-shrink: 0;
						/* Its dashed edge has to eat INTO the avatar's footprint, not add to it, or the
						   address beside it starts 2px past every other row's. */
						box-sizing: border-box;
						inline-size: 1.5rem;
						block-size: 1.5rem;
						display: flex;
						align-items: center;
						justify-content: center;
						border-radius: 50%;
						font-size: 0.8rem;
						color: var(--color-text-muted);
						border: 1px dashed color-mix(in srgb, var(--color-text) 25%, transparent);
					}

					> input {
						flex: 1;
						min-width: 0;
					}
				}

				/* The batch menu wears the popover's tinted glass over the shared menu look (menu.css.ts),
				   which also places it: dropped from the ⋯ button it anchors to, like every other menu in
				   the app. It used to override that placement to open beside the whole field — the strategy
				   the one-line pickers use, and the reason it appeared to detach from its button here. */
				> menu[popover] {
					--field-anchor: --participants-menu;
					background: var(--mitra-entry-surface);
					border: var(--border);
					box-shadow: 0px 24px 48px -8px rgba(0,0,0,0.48), 0px 4px 12px -1px rgba(0,0,0,0.24);
				}
			}
		`
	}

	protected override get template() {
		// An empty list has no header to hang the `+` on, so the add box IS the field's resting state
		// there — the placeholder is the invitation.
		const empty = !this.participants?.length
		return !this.entry ? html.nothing : html`
			${this.headerTemplate}
			${this.peopleTemplate}
			<!-- A direct child, not tucked inside the header: the menu's placement rule is scoped to the
				component's own children, while the anchor it opens against is the ⋯ button. -->
			${empty ? html.nothing : this.menuTemplate}
			${!this.canManage || !(empty || this.adding) ? html.nothing : this.addTemplate(empty)}
		`
	}

	/**
	 * The add box. It retreats when left empty, but NOT when the focus it loses is going to something
	 * else in this field: a row's own buttons appear and disappear with the pointer, and a box that
	 * vanishes on mousedown takes the row under the cursor with it — the mouseup then lands on
	 * whatever slid into its place and the click never happens. It cost the first click on every
	 * remove button while the box was open.
	 *
	 * Once there is a list it is the NEXT ROW of it — same rail, with a ghost of the
	 * avatar the person will get in the slot, so typing an address reads as filling a seat rather than
	 * as writing in a stray text box. An EMPTY field has no rail to join, and there the row's job is the
	 * opposite one: look like every other empty field, a muted placeholder on the row's centre line.
	 */
	private addTemplate(empty: boolean) {
		const input = html`
			<input class="add" type="text" inputmode="email" autocomplete="off" placeholder=${empty ? t('Add participants') : t('Add participant')}
				@keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') this.add(e.target as HTMLInputElement) }}
				@change=${(e: Event) => this.add(e.target as HTMLInputElement)}
				@blur=${(e: FocusEvent) => { this.adding = !!(e.target as HTMLInputElement).value || this.contains(e.relatedTarget as Node | null) }}>
		`
		return empty ? input : html`
			<div class="person adding">
				<div class="seat">
					<mitra-icon icon="plus"></mitra-icon>
				</div>
				${input}
			</div>
		`
	}

	private get headerTemplate() {
		const participants = this.participants
		return !participants?.length ? html.nothing : html`
			<header>
				<div class="count">
					<span>${t('${count:pluralityNumber} participants', { count: participants.length })}</span>
					<span class="summary">${participants.summary}</span>
				</div>
				<mitra-icon-button class="menu-button" label=${t('Participant options')} icon="more-horizontal"
					@click=${this.toggleMenu}
				></mitra-icon-button>
				${!this.canManage ? html.nothing : html`
					<mitra-icon-button label=${t('Add participant')} icon="plus" @click=${this.startAdding}></mitra-icon-button>
				`}
			</header>
		`
	}

	private get menuTemplate() {
		// iTIP (RFC 5546): changing the list is the organizer's call — everyone else sees why, not nothing.
		const gate = this.canManage ? undefined : t('Only the organizer can change participants')
		return html`
			<menu popover>
				<a href=${this.participants!.mailto} @click=${() => this.menu?.hidePopover()}>
					<mitra-icon icon="mail"></mitra-icon>
					${t('Email participants')}
				</a>
				<button type="button" @click=${this.copyEmails}>
					<mitra-icon icon="copy"></mitra-icon>
					${t('Copy participants\' emails')}
				</button>
				<button type="button" ?disabled=${!this.canManage} title=${gate ?? t('Ask everyone to attend')}
					@click=${() => this.markAll(ParticipantRole.Required)}>
					<mitra-icon icon="user-check"></mitra-icon>
					${t('Mark all required')}
				</button>
				<button type="button" ?disabled=${!this.canManage} title=${gate ?? t('Make attendance optional for everyone')}
					@click=${() => this.markAll(ParticipantRole.Optional)}>
					<mitra-icon icon="user-minus"></mitra-icon>
					${t('Mark all optional')}
				</button>
				<button type="button" class="danger" ?disabled=${!this.canManage} title=${gate ?? t('Remove every participant')}
					@click=${this.removeAll}>
					<mitra-icon icon="user-x"></mitra-icon>
					${t('Remove all')}
				</button>
			</menu>
		`
	}

	private get peopleTemplate() {
		const all = this.displayed
		// One row over the cap would trade itself for the expander — only fold when it actually saves space.
		const collapsible = all.length > ParticipantsField.collapsedRows + 1
		const hidden = collapsible ? all.slice(ParticipantsField.collapsedRows) : []
		return html`
			${(collapsible ? all.slice(0, ParticipantsField.collapsedRows) : all).map(participant => this.personTemplate(participant))}
			${!collapsible ? html.nothing : html`
				<details ?open=${this.expanded} @toggle=${(e: Event) => this.expanded = (e.target as HTMLDetailsElement).open}>
					<!-- The expander is a person row like any other: the faces it hides stand in the avatar
						column while it is folded, a chevron takes their place once they are on screen. -->
					<summary class="person">
						<div class="faces">
							${hidden.slice(0, ParticipantsField.previewedFaces).map(participant => html`
								<span class="face" style="--participant-color: ${Color.get(participant.email).value}">${Participants.initialOf(participant)}</span>
							`)}
						</div>
						<div class="chevron">
							<mitra-icon icon="chevron-up"></mitra-icon>
						</div>
						<span class="label more">${t('${count:number} more', { count: hidden.length })}</span>
						<span class="label fewer">${t('Show fewer participants')}</span>
					</summary>
					<!-- Rendered even while collapsed: the growth animates from the real height. -->
					<div class="rest">
						${hidden.map(participant => this.personTemplate(participant))}
					</div>
				</details>
			`}
		`
	}

	private personTemplate(participant: Participant) {
		const badge = ParticipantsField.statusBadges.get(participant.status ?? ParticipantStatus.NeedsAction)
		const optional = participant.role === ParticipantRole.Optional
		const detail = [
			participant.name,
			participant.organizer ? t('Organizer') : optional ? t('Optional') : undefined,
		].filter(Boolean).join(' · ')
		return html`
			<div class="person">
				<div class="avatar" style="--participant-color: ${Color.get(participant.email).value}">
					${Participants.initialOf(participant)}
					${!badge ? html.nothing : html`
						<div class="reply" style="--reply-color: ${badge.color}">
							<mitra-icon icon=${badge.icon}></mitra-icon>
						</div>
					`}
				</div>
				<div class="who">
					<span class="email">${participant.email}</span>
					${!detail ? html.nothing : html`<span class="detail">${detail}</span>`}
				</div>
				${!this.canManage || participant.organizer ? html.nothing : html`
					<div class="actions">
						<mitra-icon-button icon=${optional ? 'user-check' : 'user-minus'}
							label=${optional ? t('Ask this participant to attend') : t('Make attendance optional')}
							@click=${() => this.toggleRole(participant)}
						></mitra-icon-button>
						<mitra-icon-button icon="x" label=${t('Remove participant')}
							@click=${() => this.uninvite(participant)}
						></mitra-icon-button>
					</div>
				`}
			</div>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-participants-field': ParticipantsField
	}
}
