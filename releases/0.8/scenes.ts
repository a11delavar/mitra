import { aroundEditorWith, bringIntoView, click, editorOpened, openEditor, screenshot, scrollToMorning, waitFor } from '../../scripts/capture.ts'
import { still } from '../../scripts/scenes.ts'

// The captures only 0.8's notes show, shot on the build in development.

/** Today's morning medication in its editor, its time zones open on "Same time everywhere". */
still('same-time', async ({ browser, open, text }) => {
	await open()
	await scrollToMorning(browser)
	const heading = text('💊 Morning Meds')
	const chip = `[...document.querySelectorAll('mitra-day[today] mitra-entry-segment')].filter(segment => segment.textContent.includes(${JSON.stringify(heading)}))`
	await bringIntoView(browser, chip)
	await click(browser, `${chip}[0]`)
	await editorOpened(browser, heading)
	const zone = `${openEditor}.querySelector('.zone-label')`
	const picker = `${openEditor}.querySelector('mitra-time-zone-picker')`
	// Headless Chrome paints this picker only on its second open, and only into the frame after one it has captured.
	for (const open of [true, false, true]) {
		await click(browser, zone)
		await waitFor(() => browser.evaluate<boolean>(`return ${picker}?.matches(':popover-open') === ${open}`), open ? 'the time zones open' : 'the time zones closed')
		await browser.evaluate('await new Promise(resolve => setTimeout(resolve, 600))')
	}
	await screenshot(browser)
	return aroundEditorWith(browser, picker, 28)
})
