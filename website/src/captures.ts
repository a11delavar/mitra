import { getImage } from 'astro:assets'

const captures = import.meta.glob<ImageMetadata>('./assets/screenshots/**/*.webp', { eager: true, import: 'default' })

/**
 * A capture from `scripts/screenshots.ts` as hashed webp, in `language` where the website's build shot it there (a
 * folder of its own), else English's. Quality stays high: it is mostly small text.
 */
export async function captureUrl(name: string, width: number, language = 'en') {
	const source = captures[`./assets/screenshots/${language}/${name}.webp`] ?? captures[`./assets/screenshots/${name}.webp`]
	if (!source) {
		throw new Error(`Missing capture ${name}.webp. Run \`npm run screenshots\`.`)
	}
	return (await getImage({ src: source, format: 'webp', width, quality: 90 })).src
}
