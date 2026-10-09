import { getImage } from 'astro:assets'
import weekDark from './assets/screenshots/week-dark.webp'

/** The image link previews show: the app itself. Served as PNG, since some scrapers still refuse anything else. */
export async function linkPreview(site: URL | undefined) {
	const card = await getImage({ src: weekDark, format: 'png', width: 1200 })
	return new URL(card.src, site)
}
