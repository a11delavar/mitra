import { defineCollection } from 'astro:content'
import { docsLoader } from '@astrojs/starlight/loaders'
import { docsSchema } from '@astrojs/starlight/schema'

// The content in src/content/docs is a link to the repo's ./docs — the single source of truth
// that is also browsable on GitHub (created by prepare.mjs before dev/build).
export const collections = {
	docs: defineCollection({
		loader: docsLoader({
			// Treat `README.md` as a folder's index, exactly like `index.md`. That way each folder's
			// overview renders on GitHub when browsing ./docs, while the site still serves it at the
			// directory root (docs/README.md → `/`, docs/integrations/README.md → `/integrations/`).
			// Rename README → index, then apply Astro's own id logic (drop the extension; strip a
			// nested `/index`, leaving the root as the reserved `index` id it expects).
			generateId: ({ entry }) => entry
				.replace(/(^|\/)readme(\.mdx?)$/i, '$1index$2')
				.replace(/\.mdx?$/i, '')
				.replace(/\/index$/, ''),
		}),
		schema: docsSchema(),
	}),
}
