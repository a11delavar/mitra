import { aroundEditorWith, chipOf, openChip, scrollToMorning, show } from '../../scripts/capture.ts'
import { still } from '../../scripts/scenes.ts'

// The captures only 0.9's notes show, shot on the build in development.

/** The week in Japanese, set in its own typeface, a repeating event open in its editor beside its chip. */
still('japanese-week', { language: 'ja' }, async ({ browser, open, text }) => {
	await open()
	await show(browser, 'week')
	await scrollToMorning(browser)
	await browser.evaluate('await document.fonts.ready')
	const heading = text('Weekly Team Sync')
	await openChip(browser, heading)
	return aroundEditorWith(browser, chipOf(heading), 28)
})
