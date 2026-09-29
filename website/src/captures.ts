import { getImage } from 'astro:assets'

const captures = import.meta.glob<ImageMetadata>('./assets/screenshots/*.png', { eager: true, import: 'default' })

/** A capture from `scripts/screenshots.ts` as hashed webp. Quality stays high: it is mostly small text. */
export async function captureUrl(name: string, width: number) {
	const source = captures[`./assets/screenshots/${name}.png`]
	if (!source) {
		throw new Error(`Missing capture ${name}.png. Run \`npm run screenshots\`.`)
	}
	return (await getImage({ src: source, format: 'webp', width, quality: 90 })).src
}
