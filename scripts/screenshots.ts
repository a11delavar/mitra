/// <reference types="node" />
import { consola } from 'consola'
import {
	around, aroundEditorWith, aroundHomeOffice, aroundOpenDialog, capture, click, detail, details, editorOpened, hideTableLocation,
	homeOffice, keys, layers, measureAxis, open, openChip, openEditor, openFound, outDir, pickZone, press, scrollToMorning, setLayer,
	settle, show, sidebarTab, stage, waitFor, type Theme, type View,
} from './capture.ts'
import fs from 'node:fs'

// Captures the imagery the website and docs use: every view in both themes, and the week view split
// into layers. Layers share ONE page session and scroll offset, or they stop registering.
//
// Usage: npm run screenshots (it builds first, stamped with package.json's version: the sidebar prints it, and a
// version from `git describe` would write `-dirty` into every image). The harness itself lives in capture.ts.

await stage(async (browser, origin) => {
	for (const theme of ['light', 'dark'] as Array<Theme>) {
		await open(browser, origin, theme)

		for (const view of ['week', 'month', 'year', 'timeline', 'table'] as Array<View>) {
			await show(browser, view)
			if (view === 'week') {
				await scrollToMorning(browser)
			}
			if (view === 'table') {
				await hideTableLocation(browser)
			}
			await capture(browser, `${view}-${theme}`, false)
			await capture(browser, `${view}-detail-${theme}`, false, await detail(browser, details.view))
		}

		await show(browser, 'week')
		await scrollToMorning(browser)

		await press(browser, ...keys.slash())
		await capture(browser, `palette-${theme}`, false)
		await capture(browser, `palette-detail-${theme}`, false, await aroundOpenDialog(browser, 28))
		await press(browser, ...keys.escape())

		await press(browser, ...keys.comma())
		await capture(browser, `settings-${theme}`, false)
		await capture(browser, `settings-detail-${theme}`, false, await aroundOpenDialog(browser, 28))
		await press(browser, ...keys.escape())

		// One clip for every layer, so the panes stack on identical pixels.
		await measureAxis(browser)
		const clip = await detail(browser, details.week)
		for (const layer of layers) {
			await setLayer(browser, layer)
			await capture(browser, `week-${layer}-${theme}`, layer !== 'frame', clip)
		}
		await setLayer(browser, null)

		await press(browser, ...keys.question())
		await capture(browser, `shortcuts-detail-${theme}`, false, await aroundOpenDialog(browser, 28))
		await press(browser, ...keys.escape())

		await capture(browser, `calendars-detail-${theme}`, false, { x: 0, y: 0, ...details.sidebar })

		await click(browser, '[...document.querySelectorAll("mitra-sidebar .action")].find(button => button.textContent.trim() === "Add Integration")')
		await capture(browser, `integrations-detail-${theme}`, false, await aroundOpenDialog(browser, 28))
		await press(browser, ...keys.escape())

		// Back to Calendars afterwards: the tab is remembered, and the next theme's reload would open on Planning.
		await click(browser, sidebarTab('planning'))
		await capture(browser, `planning-detail-${theme}`, false, { x: 0, y: 0, ...details.sidebar })
		await click(browser, sidebarTab('calendars'))

		await press(browser, ...keys.comma())
		await click(browser, '[...document.querySelectorAll("mitra-dialog-settings nav button.page")].find(button => button.textContent.trim() === "Notifications")')
		await capture(browser, `notifications-detail-${theme}`, false, await aroundOpenDialog(browser, 28))
		await press(browser, ...keys.escape())

		// A series opens from its chip: the palette lists it once, at its first occurrence.
		await openChip(browser, 'Weekly Team Sync')
		await capture(browser, `participants-detail-${theme}`, false, await around(browser, openEditor, details.surface.width, 28))
		await press(browser, ...keys.escape())

		// Its Repeat list open, then the Custom dialog, closed again without a change.
		await openChip(browser, 'Weekly Team Sync')
		const repeat = `${openEditor}.querySelector('mitra-repeat-field mitra-select')`
		await click(browser, repeat)
		await capture(browser, `repeat-detail-${theme}`, false, await aroundEditorWith(browser, `${repeat}.shadowRoot.querySelector('mitra-listbox')`, 28))
		await click(browser, `[...${repeat}.querySelectorAll('mitra-option')].find(option => option.textContent.trim() === 'Custom…')`)
		await capture(browser, `repeat-custom-detail-${theme}`, false, await aroundOpenDialog(browser, 28))
		await press(browser, ...keys.escape())
		await press(browser, ...keys.escape())

		await openFound(browser, 'Declutter the Flat')
		await capture(browser, `hierarchy-detail-${theme}`, false, await around(browser, openEditor, details.surface.width, 28))
		await press(browser, ...keys.escape())

		await openFound(browser, 'Prepare Q3 Presentation')
		await capture(browser, `due-detail-${theme}`, false, await around(browser, openEditor, details.surface.width, 28))
		await press(browser, ...keys.escape())

		// Its notes link into an Obsidian vault: the Links row above the description, and the link within it.
		await openFound(browser, 'DA: Study Dynamic Programming')
		await capture(browser, `links-detail-${theme}`, false, await around(browser, openEditor, details.surface.width, 28))
		await press(browser, ...keys.escape())

		// A new entry, searched for a place and never saved: the reload below discards it, so no run's search becomes the next one's recent.
		await press(browser, ...keys.create())
		await waitFor(() => browser.evaluate<boolean>(`return !!${openEditor}`), 'the editor of a new entry')
		await click(browser, 'document.querySelector("mitra-location-field textarea")')
		await browser.send('Input.insertText', { text: 'Geneva' })
		await waitFor(() => browser.evaluate<boolean>('return document.querySelectorAll("mitra-location-field mitra-option").length >= 6'), 'location suggestions')
		await browser.evaluate('await new Promise(resolve => setTimeout(resolve, 400))')
		await capture(browser, `location-detail-${theme}`, false, await aroundEditorWith(browser, 'document.querySelector("mitra-location-field mitra-listbox")', 28))

		// A new entry given another zone in its editor, never saved: the reload throws it away again.
		await open(browser, origin, theme)
		await press(browser, ...keys.create())
		await waitFor(() => browser.evaluate<boolean>(`return !!${openEditor}`), 'the editor of a new entry')
		// 11:00 in Dubai is 9:00 in Berlin: the entry, and its editor with it, stay in the part of the day on screen.
		await click(browser, `${openEditor}.querySelector('.zone-label')`)
		await pickZone(browser, 'Dubai')
		await waitFor(() => browser.evaluate<boolean>(`return !!${openEditor}.querySelector('.lens')`), 'the time zone switch')
		await settle(browser)
		await browser.evaluate('await new Promise(resolve => setTimeout(resolve, 600))')
		await capture(browser, `time-zone-detail-${theme}`, false, await around(browser, openEditor, details.surface.width, 28))

		// A zone added to the week through its own ＋, then taken away again: the zones belong to the account.
		await open(browser, origin, theme)
		await show(browser, 'week')
		await scrollToMorning(browser)
		await click(browser, 'document.querySelector("mitra-time-zone-header .add")')
		await pickZone(browser, 'New York')
		await waitFor(() => browser.evaluate<boolean>('return !!document.querySelector("mitra-time-zone-header [data-alternative]")'), 'the extra time zone column')
		await settle(browser)
		await capture(browser, `time-zones-detail-${theme}`, false, await detail(browser, details.sidebar))
		await browser.evaluate('await fetch("/api/user/time-zones", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ timeZones: [] }) })')

		// Last, and the only one with availability shown. A tap on the label reaches the window beneath, as a reader's would.
		await open(browser, origin, theme, { availability: true })
		await browser.evaluate('document.documentElement.dataset.scene = "availability"')
		await capture(browser, `availability-detail-${theme}`, false, await aroundHomeOffice(browser))
		await click(browser, `${homeOffice}.querySelector('.label')`)
		await editorOpened(browser, 'Home office')
		await capture(browser, `availability-editor-detail-${theme}`, false, await around(browser, openEditor, details.surface.width, 28))
		await press(browser, ...keys.escape())
		await browser.evaluate('delete document.documentElement.dataset.scene')
	}

	consola.success(`Wrote ${fs.readdirSync(outDir).filter(name => name.endsWith('.png')).length} images to assets/screenshots`)
})
