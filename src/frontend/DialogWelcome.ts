import { component, html, css } from '@a11d/lit'
import { DialogComponent } from '@a11d/lit-application'
import { getMeta } from './Api.js'

/**
 * The first-run welcome: a calendar with no integrations is an empty grid, so this dialog greets the
 * user and walks the path from nothing to a working calendar in three quiet steps. Opened by the
 * application boot alone — only while there are zero integrations, and never over the OAuth-callback
 * flow (which already lands in an open source picker). Confirming with the CTA resolves `true` and the
 * boot chains straight into the Add-integration dialog; dismissing resolves `undefined` and leaves the
 * empty calendar be — the sidebar's own "Add Integration" stays as the way back in.
 */
@component('mitra-dialog-welcome')
export class DialogWelcome extends DialogComponent<void, boolean | undefined> {
	private static get steps() {
		return [
			{ icon: 'cable', title: t('Connect an account'), description: t('CalDAV, Google, Apple or Notion — Mitra syncs in both directions.') },
			{ icon: 'list-checks', title: t('Choose your sources'), description: t('Pick the calendars and task lists to show — recolor, rename or hide them in the sidebar anytime.') },
			{ icon: 'calendar-days', title: t('Plan your days'), description: t('Create and move entries right on the grid — every change syncs back to its source.') },
		]
	}

	protected override createRenderRoot() { return this }

	static override get styles() {
		return css`
			mitra-dialog-welcome {
				.welcome {
					display: flex;
					flex-direction: column;
					gap: 1.5rem;
					padding-block-start: 0.75rem;
				}

				/* The greeting: the mark above the words, centered — a moment of arrival, not a form. */
				.hero {
					display: flex;
					flex-direction: column;
					align-items: center;
					text-align: center;
					gap: 0.375rem;

					img {
						width: 3.25rem;
						height: 3.25rem;
						margin-block-end: 0.5rem;
					}

					h2 {
						margin: 0;
						font-size: 1.1875rem;
						font-weight: 650;
						letter-spacing: -0.015em;
					}

					p {
						margin: 0;
						font-size: 0.8438rem;
						color: var(--color-text-muted);
						text-wrap: balance;
					}
				}

				/* The path from empty to working, told as three rows: a glyph in a soft tile, then the
				   step's name over one line of detail. List semantics without list chrome. */
				.steps {
					margin: 0;
					padding: 0;
					list-style: none;
					display: flex;
					flex-direction: column;
					gap: 0.875rem;

					li {
						display: flex;
						align-items: flex-start;
						gap: 0.875rem;

						mitra-icon {
							flex-shrink: 0;
							box-sizing: border-box;
							width: 2.25rem;
							height: 2.25rem;
							padding: 0.5625rem;
							border-radius: 10px;
							background: color-mix(in srgb, var(--color-text) 5%, transparent);
							color: var(--color-text-muted);
						}

						.title {
							display: block;
							font-size: 0.8438rem;
							font-weight: 600;
							color: var(--color-text);
						}

						.description {
							display: block;
							margin-block-start: 0.125rem;
							font-size: 0.7813rem;
							line-height: 1.45;
							color: var(--color-text-muted);
						}
					}
				}

				/* The one loud element on the surface: a full-width accent CTA into the first step. */
				.cta {
					width: 100%;
					height: 2.5rem;
					font-size: 0.875rem;
					font-weight: 600;
					border: none;
					border-radius: 8px;
					background: var(--color-accent);
					color: var(--color-accent-text);

					&:not(:disabled) {
						&:hover {
							background: color-mix(in srgb, var(--color-accent) 88%, var(--color-background));
						}

						&:active {
							background: color-mix(in srgb, var(--color-accent) 78%, var(--color-background));
							box-shadow: none;
						}
					}
				}
			}
		`
	}

	protected override get template() {
		return html`
			<mitra-dialog heading=''>
				<div class="welcome">
					<header class="hero">
						<img src="/android-chrome-192x192.png" alt="">
						<h2>${t('Welcome to ${name}', { name: getMeta()?.name || 'Mitra' })}</h2>
						<p>${t('One calendar to plan your events and tasks.')}</p>
					</header>
					<ol class="steps">
						${DialogWelcome.steps.map(step => html`
							<li>
								<mitra-icon icon=${step.icon}></mitra-icon>
								<div>
									<span class="title">${step.title}</span>
									<span class="description">${step.description}</span>
								</div>
							</li>
						`)}
					</ol>
					<button class="cta" @click=${() => this.close(true)}>${t('Add your first integration')}</button>
				</div>
			</mitra-dialog>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-dialog-welcome': DialogWelcome
	}
}
