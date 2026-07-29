import { Component, component, html, css, property, state, event, query } from '@a11d/lit'
import { Color, ParticipantRole, ParticipantStatus, Participants, type Entry, type Participant } from 'shared'
import { getIntegrationFor } from '../Api.js'

/**
 * The "Participants" control for the entry editor: a header with the invitee count, the reply summary
 * ("3 yes, 3 awaiting"), an "Email participants" mailto and a batch menu — copy all e-mails, mark all
 * required/optional, remove all — followed by the participants themselves (selectable e-mails, no
 * per-person actions by design) and an add-input. The batch menu is anchored to the FIELD (see
 * field.css.ts — the field's scoped `--field` anchor, so this component needs no anchor token of its
 * own) and opens beside the row, like every other picker in the editor.
 *
 * All list behavior lives on the domain (`Entry.invite`/`markAllParticipants`/`clearParticipants` and
 * the `Participants` collection) — this component only renders and forwards. The batch actions and
 * the add-input follow iTIP (RFC 5546): only the entry's ORGANIZER may change the list
 * (`Entry.canManageParticipants`), everyone else sees them disabled — the backend enforces the same
 * rule. Fires `change` after a mutation; the host persists.
 */
@component('mitra-participants-field')
export class ParticipantsField extends Component {
	/** Collapse to this many rows (plus the "See all" expander) until expanded. */
	private static readonly collapsedRows = 4

	@property({
		type: Object,
		// The popover got reused for another entry: close the menu and collapse the list again.
		updated(this: ParticipantsField) { this.menu?.hidePopover(); this.expanded = false },
	}) entry!: Entry

	/** Fired after the entry's participant list changed, so the host can persist. */
	@event() readonly change!: EventDispatcher

	@state() private expanded = false

	protected override createRenderRoot() { return this }

	@query('menu[popover]') private readonly menu?: HTMLElement

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

	private static readonly statusBadges = new Map<ParticipantStatus, { icon: string, color: string }>([
		[ParticipantStatus.Accepted, { icon: 'check', color: Color.Green }],
		[ParticipantStatus.Declined, { icon: 'x', color: Color.Red }],
		[ParticipantStatus.Tentative, { icon: 'circle-help', color: Color.Grey }],
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

					/* The mailto wears the icon-button look, so the two trailing actions read as one set —
					   the same trailing-link treatment the location field gives its Maps opener. */
					> a.mail {
						display: inline-flex;
						align-self: center;
						padding: 0.25rem;
						border-radius: var(--border-radius);
						color: var(--color-text-muted);
						font-size: 0.87rem;
						transition: color 0.15s ease, background 0.15s ease;

						&:hover {
							color: var(--color-text);
							background: color-mix(in srgb, var(--color-text) 6%, transparent);
						}
					}

					> mitra-icon-button {
						color: var(--color-text-muted);
						font-size: 0.87rem;
						/* Swallow the button's own padding so the header stays text-height — otherwise the
						   count line sits lower than the gutter glyph beside it. */
						margin-block: -0.25rem;
					}
				}

				> .person {
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
							color: white;
							outline: 2px solid var(--color-surface);

							> mitra-icon {
								font-size: 0.5rem;
							}
						}
					}

					> .who {
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
				}

				/* A bare button: inside a field the standalone button chrome stands down (button.css.ts),
				   so the UA's own would show through — the all:unset below is what actually clears it.
				   The negative margin is the exact counterpart of its own hover padding, so the LABEL
				   still starts on the popover's content line like every other row. */
				> .more {
					all: unset;
					align-self: start;
					font-size: 0.6875rem;
					color: var(--color-text-muted);
					cursor: pointer;
					border-radius: var(--border-radius);
					margin-inline: -4px;
					padding: 2px 4px;

					&:hover {
						background: color-mix(in srgb, var(--color-text) 6%, transparent);
						color: var(--color-text);
					}
				}

				/* The add box needs no rule of its own: inside a field the input is already bare and
				   padding-less (field.css.ts), so its placeholder sits on the content line as it is. */

				/* The batch menu wears the popover's tinted glass and opens beside the row — the same
				   strategy as the source/repeat/reminder pickers. It anchors to the FIELD, which
				   field.css.ts wires up for every popover inside one. */
				> menu[popover] {
					margin: 0;
					margin-inline: 0.875rem;
					background: color-mix(in srgb, color-mix(in srgb, var(--mitra-entry-segment-color) 7.5%, var(--color-surface)) 80%, transparent);
					border: var(--border);
					box-shadow: 0px 24px 48px -8px rgba(0,0,0,0.48), 0px 4px 12px -1px rgba(0,0,0,0.24);
					position-area: inline-end span-all;
					position-try-fallbacks: flip-inline, flip-block, flip-inline flip-block;
				}
			}
		`
	}

	protected override get template() {
		return !this.entry ? html.nothing : html`
			${this.headerTemplate}
			${this.peopleTemplate}
			<!-- A direct child, not tucked inside the header: the menu's placement rule is scoped to the
				component's own children, and the anchor it opens against is the FIELD either way. -->
			${!this.participants?.length ? html.nothing : this.menuTemplate}
			${!this.canManage ? html.nothing : html`
				<input class="add" type="text" inputmode="email" autocomplete="off" placeholder=${this.participants?.length ? t('Add participant') : t('Add participants')}
					@keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') this.add(e.target as HTMLInputElement) }}
					@change=${(e: Event) => this.add(e.target as HTMLInputElement)}>
			`}
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
				<a class="mail" href=${participants.mailto} title=${t('Email participants')}>
					<mitra-icon icon="mail"></mitra-icon>
				</a>
				<mitra-icon-button label=${t('Participant options')} icon="more-horizontal"
					@click=${this.toggleMenu}
				></mitra-icon-button>
			</header>
		`
	}

	private get menuTemplate() {
		// iTIP (RFC 5546): changing the list is the organizer's call — everyone else sees why, not nothing.
		const gate = this.canManage ? undefined : t('Only the organizer can change participants')
		return html`
			<menu popover>
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
		const collapsed = !this.expanded && all.length > ParticipantsField.collapsedRows + 1
		const shown = collapsed ? all.slice(0, ParticipantsField.collapsedRows) : all
		return html`
			${shown.map(participant => this.personTemplate(participant))}
			${!collapsed ? html.nothing : html`
				<button type="button" class="more" @click=${() => this.expanded = true}>
					${t('See all ${count:number} participants', { count: all.length })}
				</button>
			`}
		`
	}

	private personTemplate(participant: Participant) {
		const badge = ParticipantsField.statusBadges.get(participant.status ?? ParticipantStatus.NeedsAction)
		const detail = [
			participant.name,
			participant.organizer ? t('Organizer') : participant.role === ParticipantRole.Optional ? t('Optional') : undefined,
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
			</div>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-participants-field': ParticipantsField
	}
}
