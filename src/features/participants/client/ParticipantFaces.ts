import { Component, component, html, css, property } from '@a11d/lit'
import { type Participant } from '../Participant.js'
import './ParticipantAvatar.js'

/** Participants' faces, overlapping, each cut out of the one before it by a ring in `--participant-faces-ring`. */
@component('mitra-participant-faces')
export class ParticipantFaces extends Component {
	@property({ type: Array }) participants: ReadonlyArray<Participant> = []

	protected override createRenderRoot() { return this }

	static override get styles() {
		return css`
			mitra-participant-faces {
				--participant-faces-ring: var(--color-surface);
				--mitra-avatar-size: 0.95rem;
				display: flex;
				align-items: center;

				> mitra-participant-avatar {
					outline: 2px solid var(--participant-faces-ring);

					& + mitra-participant-avatar {
						margin-inline-start: calc(var(--mitra-avatar-size) * -0.42);
					}
				}
			}
		`
	}

	protected override get template() {
		return html`${this.participants.map(participant => html`<mitra-participant-avatar .participant=${participant}></mitra-participant-avatar>`)}`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-participant-faces': ParticipantFaces
	}
}
