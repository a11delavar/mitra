import { Component, component, html, css, property, state, event, query, bind } from '@a11d/lit'
import { ParticipantRole, type Participants, type Participant } from '../Participant.js'
import { type Entry } from '../../entries/Entry.js'
import { getIntegrationFor, getCapabilities } from '../../../infrastructure/http/Api.js'
import './ParticipantAvatar.js'
import './ParticipantFaces.js'
import { type Menu } from '../../../design/Menu.js'

/**
 * Entry editor participants field supporting batch actions, role toggling, attendee uninviting, and collapse/expand.
 */
@component('mitra-participants-field')
export class ParticipantsField extends Component {
	private static readonly collapsedRows = 4
	private static readonly previewedFaces = 2

	@property({
		type: Object,
		updated(this: ParticipantsField) { this.menu?.hide(); this.expanded = false; this.adding = false },
	}) entry!: Entry

	@event() readonly change!: EventDispatcher

	@state() expanded = false
	@state() private adding = false

	protected override createRenderRoot() { return this }

	@query('mitra-menu') private readonly menu?: Menu
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
	}

	private markAll(role: ParticipantRole) {
		this.entry.markAllParticipants(role)
		this.changed()
	}

	private readonly removeAll = () => {
		this.entry.clearParticipants()
		this.changed()
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

				mitra-icon-button {
					color: var(--color-text-muted);
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
				}

				.person {
					display: flex;
					align-items: center;
					gap: 0.5rem;

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

				/* Opens off its own button rather than beside the editor, as the rows' pickers do. */
				> header mitra-menu[popover] {
					position-anchor: auto;
					position-area: block-end span-inline-start;
					margin: 0.25rem 0;
				}
			}
		`
	}

	protected override get template() {
		const empty = !this.participants?.length
		return !this.entry ? html.nothing : html`
			${this.headerTemplate}
			${this.peopleTemplate}
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
				<mitra-popover-container>
					<mitra-icon-button size="small" label=${t('Participant options')} icon="more-horizontal"></mitra-icon-button>
					${this.menuTemplate}
				</mitra-popover-container>
				${!this.canManage ? html.nothing : html`
					<mitra-icon-button size="small" label=${t('Add participant')} icon="plus" @click=${this.startAdding}></mitra-icon-button>
				`}
			</header>
		`
	}

	private get menuTemplate() {
		const gate = this.canManage ? undefined : t('Only the organizer can change participants')
		return html`
			<mitra-menu slot="popover">
				<mitra-menu-item icon="mail" href=${this.participants!.mailto}>${t('Email participants')}</mitra-menu-item>
				<mitra-menu-item icon="copy" @click=${this.copyEmails}>${t('Copy participants\' emails')}</mitra-menu-item>
				<mitra-menu-item icon="user-check" ?disabled=${!this.canManage} title=${gate ?? t('Ask everyone to attend')}
					@click=${() => this.markAll(ParticipantRole.Required)}>${t('Mark all required')}</mitra-menu-item>
				<mitra-menu-item icon="user-minus" ?disabled=${!this.canManage} title=${gate ?? t('Make attendance optional for everyone')}
					@click=${() => this.markAll(ParticipantRole.Optional)}>${t('Mark all optional')}</mitra-menu-item>
				<mitra-menu-item icon="user-x" variant="danger" ?disabled=${!this.canManage} title=${gate ?? t('Remove every participant')}
					@click=${this.removeAll}>${t('Remove all')}</mitra-menu-item>
			</mitra-menu>
		`
	}

	private get peopleTemplate() {
		const all = this.displayed
		const collapsible = all.length > ParticipantsField.collapsedRows + 1
		const hidden = collapsible ? all.slice(ParticipantsField.collapsedRows) : []
		return html`
			${(collapsible ? all.slice(0, ParticipantsField.collapsedRows) : all).map(participant => this.personTemplate(participant))}
			${!collapsible ? html.nothing : html`
				<details ?open=${bind(this, 'expanded', { event: 'toggle' })}>
					<summary class="person">
						<mitra-participant-faces class="faces" .participants=${hidden.slice(0, ParticipantsField.previewedFaces)}></mitra-participant-faces>
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
		const optional = participant.role === ParticipantRole.Optional
		const detail = [
			participant.name,
			participant.organizer ? t('Organizer') : optional ? t('Optional') : undefined,
		].filter(Boolean).join(' · ')
		return html`
			<div class="person">
				<mitra-participant-avatar .participant=${participant} reply></mitra-participant-avatar>
				<div class="who">
					<span class="email">${participant.email}</span>
					${!detail ? html.nothing : html`<span class="detail">${detail}</span>`}
				</div>
				${!this.canManage || participant.organizer ? html.nothing : html`
					<div class="actions">
						<mitra-icon-button size="small" icon=${optional ? 'user-check' : 'user-minus'}
							label=${optional ? t('Ask this participant to attend') : t('Make attendance optional')}
							@click=${() => this.toggleRole(participant)}
						></mitra-icon-button>
						<mitra-icon-button size="small" icon="x" label=${t('Remove participant')}
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
