import { type Clip, click, waitFor } from '../../scripts/capture.ts'
import { still } from '../../scripts/scenes.ts'

// The captures only 0.7's notes show, shot on the build in development.

/** The About dialog, open on the latest release: its notes and pictures, as the website shows them. */
still('about', async ({ browser, open }) => {
	await open()
	await click(browser, `document.querySelector('mitra-sidebar button.brand')`)
	const dialog = `document.querySelector('mitra-dialog-about mitra-dialog')?.shadowRoot?.querySelector('dialog[open]')`
	await waitFor(() => browser.evaluate<boolean>(`return !!${dialog}`), 'the About dialog')
	await waitFor(() => browser.evaluate<boolean>(`
		const pictures = [...document.querySelectorAll('mitra-dialog-about img')].filter(picture => picture.checkVisibility() && picture.getBoundingClientRect().top < innerHeight)
		return pictures.length > 0 && pictures.every(picture => picture.complete && picture.naturalWidth > 0)
	`), 'the release\'s pictures')
	await browser.evaluate('await new Promise(resolve => setTimeout(resolve, 800))')
	return browser.evaluate<Clip>(`
		const box = ${dialog}.getBoundingClientRect()
		return { x: Math.round(box.x - 24), y: Math.round(box.y - 24), width: Math.round(box.width + 48), height: Math.round(box.height + 48) }
	`)
})
