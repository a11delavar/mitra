import {
	aroundEditorWith, attachToSample, chipOf, type Clip, click, keys, openChip, openEditor, openFound, press, sampleAttachments,
	scrollToMorning, show, waitFor,
} from '../../scripts/capture.ts'
import { still } from '../../scripts/scenes.ts'

// The captures only 0.7's notes show, shot on the build in development.

/**
 * The Language setting open on its languages, Italian unfolded to the countries it is written in, above the preview of
 * the format in force. English folds first: it unfolds by itself around the captures' own region, and runs long.
 */
still('locales', async ({ browser, open }) => {
	await open()
	await press(browser, ...keys.comma())
	const select = `[...document.querySelectorAll('mitra-dialog-settings mitra-select')].find(select => select.querySelector('mitra-option-tree'))`
	await waitFor(() => browser.evaluate<boolean>(`return !!${select}?.checkVisibility()`), 'the Language setting')
	await click(browser, `${select}.shadowRoot.querySelector('[part=button]')`)
	await waitFor(() => browser.evaluate<boolean>(`return ${select}.hasAttribute('open')`), 'the languages')
	const tree = (language: string) => `[...${select}.querySelectorAll('mitra-option[slot=header]')].find(option => option.value === ${JSON.stringify(language)})`
	// By keyboard: the list opens scrolled to the captures' region, deep in English, out of a pointer's reach.
	await press(browser, 'Home', 'Home', 36)
	await press(browser, 'ArrowLeft', 'ArrowLeft', 37)
	for (const _ of ['de', 'fr', 'es', 'pt', 'it']) {
		await press(browser, 'ArrowDown', 'ArrowDown', 40)
	}
	await press(browser, 'ArrowRight', 'ArrowRight', 39)
	await waitFor(() => browser.evaluate<boolean>(`return ${tree('it')}.parentElement.hasAttribute('open') && !${tree('en')}.parentElement.hasAttribute('open')`), 'Italian unfolded')
	await browser.evaluate('await new Promise(resolve => setTimeout(resolve, 600))')
	return browser.evaluate<Clip>(`
		const dialog = [...document.querySelectorAll('mitra-dialog')].map(host => host.shadowRoot?.querySelector('dialog')).find(dialog => dialog?.open)
		const boxes = [dialog, ${select}.shadowRoot.querySelector('[part=listbox]')].map(element => element.getBoundingClientRect())
		const left = Math.max(0, Math.min(...boxes.map(box => box.left)) - 24)
		const top = Math.max(0, Math.min(...boxes.map(box => box.top)) - 24)
		const right = Math.min(innerWidth, Math.max(...boxes.map(box => box.right)) + 24)
		const bottom = Math.min(innerHeight, Math.max(...boxes.map(box => box.bottom)) + 24)
		return { x: Math.round(left), y: Math.round(top), width: Math.round(right - left), height: Math.round(bottom - top) }
	`)
})

/**
 * The time zone picker opened from the time column, at home: Berlin with its house among the grouped rows around it,
 * each standing for the cities that share its name and clock.
 */
still('time-zones', async ({ browser, open }) => {
	await open()
	await click(browser, `document.querySelector('mitra-time-zone-header mitra-icon-button.add')`)
	const picker = `[...document.querySelectorAll('mitra-time-zone-picker')].find(picker => picker.matches(':popover-open'))`
	const home = `[...${picker}.shadowRoot.querySelectorAll('mitra-option[slot=header]')].find(option => option.value === 'Europe/Berlin')`
	await waitFor(() => browser.evaluate<boolean>(`return !!${picker} && !!${home}`), 'the time zone picker')
	// The list opens at the zones furthest west; home sits in the middle of it.
	await browser.evaluate(`${home}.scrollIntoView({ block: 'center' })`)
	await browser.evaluate('await new Promise(resolve => setTimeout(resolve, 600))')
	return browser.evaluate<Clip>(`
		const boxes = [document.querySelector('mitra-time-zone-header'), ${picker}].map(element => element.getBoundingClientRect())
		const left = Math.max(0, Math.min(...boxes.map(box => box.left)) - 24)
		const top = Math.max(0, Math.min(...boxes.map(box => box.top)) - 24)
		const right = Math.min(innerWidth, Math.max(...boxes.map(box => box.right)) + 24)
		const bottom = Math.min(innerHeight, Math.max(...boxes.map(box => box.bottom)) + 24)
		return { x: Math.round(left), y: Math.round(top), width: Math.round(right - left), height: Math.round(bottom - top) }
	`)
})

/** Chinese, in its own typeface: a repeating event's editor with its date picker open on the month, as 0.6 showed Persian. */
still('chinese-detail', { language: 'zh' }, async ({ browser, open, text }) => {
	await open()
	await openFound(browser, text('Weekly Team Sync'))
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
 * The architecture draft with three files, the sketch shown in its description: the paperclip on its chip and the row in its
 * editor beside it, as the attachments guide shows them, kept here as 0.7 had them. The runner rebuilds the sample after it.
 */
still('attachments', async ({ browser, origin, open, text }) => {
	const drafted = text('Draft New System Architecture')
	await attachToSample(origin, drafted, sampleAttachments, 'Whiteboard sketch.png')
	await open()
	await show(browser, 'week')
	await scrollToMorning(browser)
	await openChip(browser, drafted)
	return aroundEditorWith(browser, chipOf(drafted), 28)
})

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
