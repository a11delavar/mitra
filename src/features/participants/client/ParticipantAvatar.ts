import { Component, component, html, css, property } from '@a11d/lit'
import { ParticipantStatus, Participants, type Participant } from '../Participant.js'
import { Color } from '../../sources/Color.js'
import { contrastColorOf } from '../../../design/contrastColor.js'

/** A participant's face: their initial in the colour their address stands for, and optionally the badge of their reply. */
@component('mitra-participant-avatar')
export class ParticipantAvatar extends Component {
	private static readonly replyBadges = new Map<ParticipantStatus, { icon: string, color: string }>([
		[ParticipantStatus.Accepted, { icon: 'check', color: Color.Green }],
		[ParticipantStatus.Declined, { icon: 'x', color: Color.Red }],
		[ParticipantStatus.Tentative, { icon: 'minus', color: Color.Yellow }],
	])

	@property({ type: Object }) participant!: Participant
	@property({ type: Boolean }) reply = false

	protected override createRenderRoot() { return this }

	static override get styles() {
		return css`
			mitra-participant-avatar {
				position: relative;
				flex-shrink: 0;
				display: inline-flex;
				border-radius: 50%;

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
					outline: 2px solid var(--color-surface);
					${contrastColorOf('color', 'var(--reply-color)')};

					> mitra-icon {
						font-size: 0.5rem;
						--mitra-icon-stroke-width: 4;
					}
				}
			}
		`
	}

	protected override get template() {
		const { participant } = this
		const badge = !this.reply ? undefined : ParticipantAvatar.replyBadges.get(participant.status ?? ParticipantStatus.NeedsAction)
		return html`
			<mitra-avatar initial=${Participants.initialOf(participant)} color=${Color.get(participant.email).value}></mitra-avatar>
			${!badge ? html.nothing : html`
				<span class="reply" style="--reply-color: ${badge.color}">
					<mitra-icon icon=${badge.icon}></mitra-icon>
				</span>
			`}
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-participant-avatar': ParticipantAvatar
	}
}
