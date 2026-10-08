import { css } from '@a11d/lit'

/**
 * The two channels a reader can run: the newest release (the `:latest` image) and what is in development (`:dev`).
 * Declarations only, for each surface to put where its releases show.
 */
export const releaseColors = css`
	--release-latest: light-dark(#1f8a5b, #4fc48f);
	--release-gold: light-dark(#a8670f, #e8ac4f);
	--release-dev: var(--release-gold);
`

/**
 * How a release reads, on the website's release page and in the app's About dialog alike (`website/tools/tokens.mjs`
 * emits it for the site). Both mark a release up with these classes under `.release-notes`; each lays out its own hero
 * and sets the sizes below.
 */
export const releaseNotes = css`
	.release-notes {
		${releaseColors};
		--release-heading: 1.0625rem;
		--release-section: 1rem;
		--release-text: 0.875rem;
		--release-shot-height: min(30rem, 60vh);
		--release-hairline: color-mix(in srgb, var(--color-text) 8%, transparent);
		container: release-notes / inline-size;

		&[data-state=latest] :is(.version, .mark) {
			color: var(--release-latest);
		}

		&[data-state=draft] :is(.version, .mark) {
			color: var(--release-dev);
		}

		&[data-state=planned] :is(.version, .mark) {
			color: var(--color-text-muted);
		}

		.prose {
			font-size: var(--release-text);
			color: var(--color-text-muted);

			p {
				margin: 0;
			}

			p + p {
				margin-block-start: 0.75rem;
			}

			a {
				color: var(--color-text);
				text-decoration: underline;
				text-underline-offset: 3px;
				text-decoration-color: color-mix(in srgb, currentColor 35%, transparent);
			}
		}

		/* A letter a release opens with: its first sentence as a statement, a rule in Mitra's colour, who signed it. */
		.letter {
			display: grid;
			justify-items: start;
			gap: 1.5rem;
			padding-inline-start: 1.5rem;
			border-inline-start: 2px solid color-mix(in srgb, var(--release-gold) 70%, transparent);
			line-height: 1.7;

			.prose {
				p + p {
					margin-block-start: 1em;
				}

				p:first-child {
					font-size: 1.375em;
					line-height: 1.45;
					font-weight: 550;
					color: var(--color-text);
					text-wrap: pretty;
				}
			}

			.signature {
				display: flex;
				align-items: center;
				gap: 0.75rem;
				font-size: var(--release-text);
				font-weight: 600;
				color: var(--color-text);
				text-decoration: none;

				img {
					inline-size: 2.5rem;
					block-size: 2.5rem;
					border-radius: 50%;
				}
			}
		}

		/* Text beside its capture, the side alternating down the page. */
		.highlight {
			display: grid;
			grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
			gap: clamp(1.5rem, 4vw, 3rem);
			align-items: center;

			&[data-side=start] {
				grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);

				.text {
					order: 2;
				}
			}

			&:not(:has(.shot)) {
				grid-template-columns: minmax(0, 1fr);
			}

			.text {
				display: flex;
				flex-direction: column;
				gap: 0.75rem;
			}

			.heading {
				margin: 0;
				display: flex;
				align-items: center;
				gap: 0.5rem;
				font-size: var(--release-heading);
				font-weight: 650;
			}
		}

		@container release-notes (max-width: 40rem) {
			.highlight,
			.highlight[data-side=start] {
				grid-template-columns: minmax(0, 1fr);

				.text {
					order: 0;
				}
			}
		}

		/* The way to the docs, beside the heading and out of the text. */
		.docs {
			display: inline-flex;
			font-size: 0.8em;
			color: var(--color-text-muted);
			opacity: 0.7;
			transition: opacity 150ms, color 150ms;

			&:hover,
			&:focus-visible {
				opacity: 1;
				color: var(--color-accent);
			}
		}

		/* Never taller than a screen's worth beside its text, each take in its theme: the chosen one, else the system's. */
		.shot {
			margin: 0;
			inline-size: fit-content;
			max-inline-size: 100%;
			justify-self: center;
			border: 1px solid color-mix(in srgb, var(--color-text) 14%, transparent);
			border-radius: 0.625rem;
			overflow: hidden;
			background: var(--color-background);

			a {
				display: block;
			}

			:is(img, video) {
				display: block;
				max-inline-size: 100%;
				max-block-size: var(--release-shot-height);
				inline-size: auto;
				block-size: auto;
			}

			.dark {
				display: none;
			}

			:root[data-theme=dark] & {
				.light {
					display: none;
				}

				.dark {
					display: block;
				}
			}

			@media (prefers-color-scheme: dark) {
				:root:not([data-theme]) & {
					.light {
						display: none;
					}

					.dark {
						display: block;
					}
				}
			}
		}

		/* What the changelog says, set apart from the notes. */
		.emitted {
			display: flex;
			flex-direction: column;
			gap: 1.25rem;
			padding-block-start: 2.5rem;
			border-block-start: 1px solid var(--release-hairline);

			> .title {
				margin: 0;
				font-size: var(--release-section);
				font-weight: 650;

				small {
					margin-inline-start: 0.5rem;
					font-size: 0.875rem;
					font-weight: 400;
					color: var(--color-text-muted);
				}
			}
		}

		.patch {
			display: grid;
			grid-template-columns: 4rem 7rem minmax(0, 1fr);
			gap: 1rem;
			align-items: baseline;

			b {
				font-weight: 600;
				font-variant-numeric: tabular-nums;
			}

			.date {
				color: var(--color-text-muted);
				font-variant-numeric: tabular-nums;
			}

			@container release-notes (max-width: 40rem) {
				grid-template-columns: 4rem minmax(0, 1fr);

				.date {
					display: none;
				}
			}
		}

		.category {
			display: flex;
			flex-direction: column;
			gap: 0.4rem;

			& + .category {
				margin-block-start: 1rem;
			}

			> .label {
				margin: 0;
				font-size: 0.75rem;
				font-weight: 600;
				color: var(--color-text-muted);
			}
		}

		/* One commit a row: its subject, and its hash at the end. */
		.lines {
			margin: 0;
			padding: 0;
			list-style: none;
			display: flex;
			flex-direction: column;

			li {
				display: flex;
				justify-content: space-between;
				align-items: baseline;
				gap: 1rem;
				padding-block: 0.35rem;
				border-block-end: 1px solid var(--release-hairline);
				font-size: var(--release-text);

				&:last-child {
					border-block-end: 0;
				}
			}

			.hash {
				flex: none;
				font-family: ui-monospace, 'Cascadia Code', 'SF Mono', Menlo, monospace;
				font-size: 0.75rem;
				color: var(--color-text-muted);
				text-decoration: none;

				&:hover {
					color: var(--color-text);
				}
			}
		}

		.people {
			margin: 0;
			padding: 0;
			list-style: none;
			display: flex;
			flex-wrap: wrap;
			gap: 1rem 2rem;

			li {
				display: flex;
				align-items: center;
				gap: 0.6rem;
				font-size: var(--release-text);
			}

			a {
				display: flex;
				align-items: center;
				gap: 0.6rem;
				color: var(--color-text);
				text-decoration: none;

				&:hover {
					text-decoration: underline;
					text-underline-offset: 3px;
				}
			}

			:is(img, .initial) {
				inline-size: 2.5rem;
				block-size: 2.5rem;
				border-radius: 50%;
				border: 1px solid color-mix(in srgb, var(--color-text) 14%, transparent);
			}

			.initial {
				display: grid;
				place-items: center;
				font-weight: 600;
				background: color-mix(in srgb, var(--color-accent) 12%, transparent);
			}

			small {
				color: var(--color-text-muted);
			}
		}

		.links {
			display: flex;
			flex-wrap: wrap;
			gap: 1.25rem;

			a {
				font-size: 0.8125rem;
				color: var(--color-text-muted);
				text-decoration: underline;
				text-underline-offset: 3px;
				text-decoration-color: color-mix(in srgb, currentColor 30%, transparent);

				&:hover {
					color: var(--color-text);
					text-decoration-color: currentColor;
				}
			}
		}
	}
`
