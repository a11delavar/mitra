import {
	aroundEditorWith, aroundOpenDialog, appText, bringIntoView, chipOf, click, editorOpened, openChip, openEditor, screenshot, scrollToMorning, show, waitFor,
} from '../../scripts/capture.ts'
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

/** The Add integration dialog, the pointer resting on Todoist. */
still('todoist', async ({ browser, open, language }) => {
	const ui = (english: string) => appText(english, language)
	await open()
	await click(browser, `[...document.querySelectorAll("mitra-sidebar .action")].find(button => button.textContent.trim() === ${JSON.stringify(ui('Add Integration'))})`)
	const todoist = `[...document.querySelectorAll("mitra-dialog-integration button.type")].find(button => button.querySelector(".name")?.textContent.trim() === ${JSON.stringify(ui('Todoist'))})`
	await waitFor(() => browser.evaluate<boolean>(`return !!${todoist}`), 'Todoist among the integrations')
	const point = await browser.evaluate<{ x: number, y: number }>(`const { x, y, width, height } = ${todoist}.getBoundingClientRect(); return { x: x + width / 2, y: y + height / 2 }`)
	await browser.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point, button: 'none' })
	await browser.evaluate('await new Promise(resolve => setTimeout(resolve, 400))')
	return aroundOpenDialog(browser, 28)
})

/**
 * Next Tuesday's physiotherapy in Duplicate to other days, the seven sessions the practice handed out after it chosen across
 * October and November. A month's buttons are its days in order, as the neighbours' days are blank cells: no date is read.
 */
still('duplicate-days', async ({ browser, open, text }) => {
	await open()
	await browser.evaluate(`
		const calendar = document.querySelector('mitra-page-calendar')
		calendar.step(1)
		await calendar.updateComplete
	`)
	const heading = text('Physiotherapy')
	await waitFor(() => browser.evaluate<boolean>(`return !!${chipOf(heading)}`), 'the physiotherapy session')
	// An evening session lies below the hours the captures open on.
	await browser.evaluate(`${chipOf(heading)}.scrollIntoView({ block: 'center' }); await new Promise(resolve => setTimeout(resolve, 600))`)
	await openChip(browser, heading)
	await click(browser, `${openEditor}.querySelector('mitra-icon-button[icon="more-horizontal"]')`)
	await click(browser, `[...document.querySelectorAll('mitra-menu-item')].find(item => item.getAttribute('icon') === 'copy-plus')`)
	const grids = `document.querySelector('mitra-dialog-duplicate-days mitra-date-picker')?.shadowRoot.querySelectorAll('[role=grid]')`
	await waitFor(() => browser.evaluate<boolean>(`return ${grids}?.length === 2`), 'the duplicate dialog')
	const sessions = [[0, 9], [0, 14], [0, 16], [0, 21], [0, 26], [0, 29], [1, 4]] as const
	for (const [month, day] of sessions) {
		await click(browser, `${grids}[${month}].querySelectorAll('button')[${day - 1}]`)
	}
	await waitFor(() => browser.evaluate<boolean>(`return document.querySelector('mitra-dialog-duplicate-days mitra-date-picker').value.length === ${sessions.length}`), 'the sessions chosen')
	return aroundOpenDialog(browser, 28)
})

/** Arabic as Egypt writes it, right to left in Arabic-Indic digits: the week starting on Saturday, a repeating event open in its editor beside its chip. */
still('arabic-week', { language: 'ar', locale: 'ar-EG' }, async ({ browser, open, text }) => {
	await open()
	await show(browser, 'week')
	await scrollToMorning(browser)
	await browser.evaluate('await document.fonts.ready')
	const heading = text('Weekly Team Sync')
	await openChip(browser, heading)
	return aroundEditorWith(browser, chipOf(heading), 28)
})
