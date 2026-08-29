import { Component, component, html, css, property, state, event, query } from '@a11d/lit'
import { ParticipantRole, ParticipantStatus, Participants, type Participant } from '../Participant.js'
import { type Entry } from '../../entries/Entry.js'
import { Color } from '../../sources/Color.js'
import { getIntegrationFor, getCapabilities } from '../../../infrastructure/http/Api.js'
import { contrastColor } from '../../../design/contrastColor.js'

/**
 * Entry editor participants field supporting batch actions, role toggling, attendee uninviting, and collapse/expand.
 */
@component('mitra-participants-field')
export class ParticipantsField extends Component {
	private static readonly collapsedRows = 4
	private static readonly previewedFaces = 2

	@property({
		type: Object,
		updated(this: ParticipantsField) { this.menu?.hidePopover(); this.expanded = false; this.adding = false },
	}) entry!: Entry

	@event() readonly change!: EventDispatcher

	@state() private expanded = false
	@state() private adding = false

	protected override createRenderRoot() { return this }

	@query('menu[popover]') private readonly menu?: HTMLElement
	@query('input.add') private readonly addInput?: HTMLInputElement

	private get participants(): Participants | null {
		return this.entry.participantList
	}

	private get displayed(): Array<Participant> {
		return this.participants?.organizerFirst ?? []
	}

	/** Whether the current user can manage participants (requires write access and organizer status). */
	private get canManage() {
		return getCapabilities(this.entry.sourceId).editEntries && this.entry.canManageParticipants
	}

	private get ownAddress(): string | undefined {
		return getIntegrationFor(this.entry.sourceId)?.addresses?.[0]
	}

	private changed() {
		this.requestUpdate()
		this.change.dispatch()
	}

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
				justify-content: center;
				gap: 0.375rem;
				padding-block: calc((var(--control-height) - 2px - 1lh) / 2);
				anchor-scope: --participants-menu;

				mitra-icon-button {
					color: var(--color-text-muted);
					font-size: 0.87rem;
					margin-block: -0.25rem;
				}

				> header {
					display: flex;
					align-items: center;

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

					> .menu-button {
						anchor-name: --participants-menu;
					}
				}

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
							color: ${contrastColor('var(--reply-color)')};
							outline: 2px solid var(--color-surface);

							> mitra-icon {
								font-size: 0.5rem;
								--mitra-icon-stroke-width: 4;
							}
						}
					}

					> .who {
						flex: 1;
						min-width: 0;
						display: flex;
						flex-direction: column;

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

					> .actions {
						display: flex;
						align-items: center;
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

					> .rest {
						display: flex;
						flex-direction: column;
						gap: 0.375rem;
						margin-block-end: 0.375rem;
					}

					> summary {
						order: 1;
						cursor: pointer;
						list-style: none;
						color: var(--color-text-muted);
						transition: color 0.15s ease;

						&:hover {
							color: var(--color-text);
						}

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

				> .adding {
					> .seat {
						flex-shrink: 0;
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
		const empty = !this.participants?.length
		return !this.entry ? html.nothing : html`
			${this.headerTemplate}
			${this.peopleTemplate}
			${empty ? html.nothing : this.menuTemplate}
			${!this.canManage || !(empty || this.adding) ? html.nothing : this.addTemplate(empty)}
		`
	}

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
		const collapsible = all.length > ParticipantsField.collapsedRows + 1
		const hidden = collapsible ? all.slice(ParticipantsField.collapsedRows) : []
		return html`
			${(collapsible ? all.slice(0, ParticipantsField.collapsedRows) : all).map(participant => this.personTemplate(participant))}
			${!collapsible ? html.nothing : html`
				<details ?open=${this.expanded} @toggle=${(e: Event) => this.expanded = (e.target as HTMLDetailsElement).open}>
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
