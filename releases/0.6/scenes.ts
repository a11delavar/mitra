import { aroundEditorWith, click, type Clip, openEditor, openFound, scrollToMorning, settle, show, sidebarTab, waitFor } from '../../scripts/capture.ts'
import { middleOf, type Point } from '../../scripts/film.ts'
import { film, still } from '../../scripts/scenes.ts'

// The captures only 0.6's notes show, shot at v0.6.0. The rest of its notes borrow the docs' captures by name.

/** Persian, with its own calendar: a task's editor with its date picker open on a Persian month. */
still('persian-calendar-detail', { language: 'fa' }, async ({ browser, open, text }) => {
	await open()
	await openFound(browser, text('Prepare Q3 Presentation'))
	await browser.evaluate('await document.fonts.ready')
	// The editor's rows hide the field's own picker button and open the picker from the row, so the click lands on the segments.
	const dateField = `${openEditor}.querySelector('.start > :is(mitra-date-field, mitra-date-time-field)')`
	await click(browser, `${dateField}.shadowRoot.querySelector('[part=segments]')`)
	const datePicker = `${dateField}.shadowRoot.querySelector('mitra-popover[open]')`
	await waitFor(() => browser.evaluate<boolean>(`return !!${datePicker}`), 'the date picker')
	await browser.evaluate('await new Promise(resolve => setTimeout(resolve, 600))')
	return aroundEditorWith(browser, datePicker, 28)
})

/**
 * A task's checklist and its subtask, counted together by the menu of its status. Saturday is parked at the window's end,
 * so the editor opens beside the chips on their left, and the subtask's chip stays in sight.
 */
still('checklist', async ({ browser, open, text }) => {
	await open()
	await show(browser, 'week')
	await scrollToMorning(browser)
	const chip = (heading: string) => `[...document.querySelectorAll('mitra-days mitra-entry-segment')].find(segment => segment.textContent.includes(${JSON.stringify(text(heading))}) && segment.getBoundingClientRect().width > 0)`
	await browser.evaluate(`
		const scroller = document.querySelector('mitra-days')
		scroller.scrollLeft += ${chip('Declutter the Flat')}.closest('mitra-day').getBoundingClientRect().right - innerWidth + 8
		await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
	`)
	await settle(browser)
	await click(browser, chip('Declutter the Flat'))
	await waitFor(() => browser.evaluate<boolean>(`return !!${openEditor}`), 'the editor of the task')
	await settle(browser)
	// Alt opens the status menu, as a right click does; a plain click would tick the task off.
	await click(browser, `${openEditor}.querySelector('mitra-task-status button.status-button')`, 1)
	const menu = `${openEditor}.querySelector('mitra-task-status mitra-menu')`
	await waitFor(() => browser.evaluate<boolean>(`return !!${menu}?.matches('[open]')`), 'the status menu')
	await browser.evaluate('await new Promise(resolve => setTimeout(resolve, 600))')
	// Close on what the highlight is about: the task, its checklist, its subtask and the menu counting them.
	return browser.evaluate<Clip>(`
		const elements = [${openEditor}.querySelector('.title-row'), ${openEditor}.querySelector('.description mitra-markdown'), ${openEditor}.querySelector('mitra-relations-field .row:has(.tally)'), ${menu}, ${chip('Declutter the Flat')}, ${chip('Clear Out the Cellar')}]
		const boxes = elements.map(element => element.getBoundingClientRect())
		const left = Math.max(0, Math.min(...boxes.map(box => box.left)) - 28)
		const top = Math.max(0, Math.min(...boxes.map(box => box.top)) - 28)
		const right = Math.min(innerWidth, Math.max(...boxes.map(box => box.right)) + 28)
		const bottom = Math.min(innerHeight, Math.max(...boxes.map(box => box.bottom)) + 28)
		return { x: Math.round(left), y: Math.round(top), width: Math.round(right - left), height: Math.round(bottom - top) }
	`)
})

/** A task dragged from Planning into the week: the estimate becomes its length where it lands. */
film('plan-task', async ({ browser, open, text, record }) => {
	await open()
	await show(browser, 'week')
	await scrollToMorning(browser)
	await click(browser, sidebarTab('planning'))
	await settle(browser)
	const heading = JSON.stringify(text('Draft the hiring plan'))
	const chipFind = `[...document.querySelectorAll('mitra-planning section.unscheduled mitra-entry-segment')].find(segment => segment.textContent.includes(${heading}))`
	await waitFor(() => browser.evaluate<boolean>(`return !!${chipFind}`), 'the unscheduled task')
	const chip = await middleOf(browser, chipFind)
	// The first free afternoon hour of the day column in the middle of the week that is fully on screen.
	const target = await browser.evaluate<Point>(`
		const main = document.querySelector('mitra-page-calendar main').getBoundingClientRect()
		const days = [...document.querySelectorAll('mitra-days mitra-day')].filter(day => {
			const { x, right } = day.getBoundingClientRect()
			return x >= main.x && right <= innerWidth
		})
		const day = days[Math.floor(days.length / 2)]
		const entries = day.querySelector('.entries').getBoundingClientRect()
		const hour = [12, 13, 15, 16, 11].find(hour => {
			const y = entries.top + entries.height * hour / 24
			return y > 140 && y < innerHeight - 120
		}) ?? 13
		return { x: entries.x + entries.width / 2, y: entries.top + entries.height * hour / 24 }
	`)
	const recording = record()
	await recording.start()
	// The pointer sets off from the empty part of the sidebar below the list, inside the picture.
	const park = { x: chip.x + 30, y: chip.y + 170 }
	await recording.hold(park, 0.4)
	await recording.move(park, chip, 0.7)
	await recording.hold(chip, 0.2)
	await recording.press(chip)
	await recording.move(chip, target, 1.4, true)
	await recording.hold(target, 0.3)
	await recording.release(target)
	await recording.until(`return [...document.querySelectorAll('mitra-days mitra-entry-segment')].some(segment => segment.textContent.includes(${heading}))`, 'the task in the week')
	await recording.hold(target, 1.4)
	await recording.stop()
})
