/// <reference types="node" />
import { consola } from 'consola'
import {
	appText, around, aroundEditorWith, aroundHomeOffice, aroundOpenDialog, attachToSample, capture, chipOf, click, detail, details, editorOpened, hideTableLocation,
	homeOfficeIn, keys, layers, measureAxis, open, openChip, openEditor, openFound, outDirOf, pickZone, press, sampleText, scrollToMorning,
	rewriteAnswers, sampleAttachments, setLayer, settle, show, sidebarTab, stage, waitFor, capturedAt, type Clip, type Theme, type View,
} from './capture.ts'
import fs from 'node:fs'
import path from 'node:path'

// Captures the imagery the website and docs use: every view in both themes, and the week view split
// into layers. Layers share ONE page session and scroll offset, or they stop registering.
//
// Usage: npm run screenshots [-- --language de] (it builds first, stamped with package.json's version: the sidebar
// prints it, and a version from `git describe` would write `-dirty` into every image; `--no-build` reuses the last
// build). English is committed; another language is the website's to shoot while it builds, into a gitignored folder.
// The harness itself lives in capture.ts.

const argument = (name: string) => process.argv[process.argv.indexOf(name) + 1]
const language = process.argv.includes('--language') ? argument('--language')! : 'en'
// What the scenes click and search for, in the language they are shot in.
const ui = (english: string) => appText(english, language)
const sample = (english: string) => sampleText(english, language)

await stage(async (browser, origin) => {
	const shot = (file: string, transparent: boolean, clip?: Clip) => capture(browser, file, transparent, clip, language)
	const reopen = (theme: Theme, options: { availability?: boolean } = {}) => open(browser, origin, theme, { ...options, language })
	for (const [name, scope] of [['Claude', 'write'], ['Cursor', 'read']]) {
		await fetch(`${origin}api/user/access-tokens`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, scope }) })
	}
	for (const theme of ['light', 'dark'] as Array<Theme>) {
		await reopen(theme)

		for (const view of ['week', 'month', 'year', 'timeline', 'table'] as Array<View>) {
			await show(browser, view)
			if (view === 'week') {
				await scrollToMorning(browser)
			}
			if (view === 'table') {
				await hideTableLocation(browser, language)
			}
			await shot(`${view}-${theme}`, false)
			await shot(`${view}-detail-${theme}`, false, await detail(browser, details.view))
		}

		await show(browser, 'week')
		await scrollToMorning(browser)

		await press(browser, ...keys.slash())
		await shot(`palette-${theme}`, false)
		await shot(`palette-detail-${theme}`, false, await aroundOpenDialog(browser, 28))
		await press(browser, ...keys.escape())

		await press(browser, ...keys.comma())
		await shot(`settings-${theme}`, false)
		await shot(`settings-detail-${theme}`, false, await aroundOpenDialog(browser, 28))
		await press(browser, ...keys.escape())

		// One clip for every layer, so the panes stack on identical pixels.
		await measureAxis(browser)
		const clip = await detail(browser, details.week)
		for (const layer of layers) {
			await setLayer(browser, layer)
			await shot(`week-${layer}-${theme}`, layer !== 'frame', clip)
		}
		await setLayer(browser, null)

		await press(browser, ...keys.question())
		await shot(`shortcuts-detail-${theme}`, false, await aroundOpenDialog(browser, 28))
		await press(browser, ...keys.escape())

		await shot(`calendars-detail-${theme}`, false, { x: 0, y: 0, ...details.sidebar })

		await click(browser, `[...document.querySelectorAll("mitra-sidebar .action")].find(button => button.textContent.trim() === ${JSON.stringify(ui('Add Integration'))})`)
		await shot(`integrations-detail-${theme}`, false, await aroundOpenDialog(browser, 28))
		await press(browser, ...keys.escape())

		// Back to Calendars afterwards: the tab is remembered, and the next theme's reload would open on Planning.
		await click(browser, sidebarTab('planning'))
		await shot(`planning-detail-${theme}`, false, { x: 0, y: 0, ...details.sidebar })
		await click(browser, sidebarTab('calendars'))

		await press(browser, ...keys.comma())
		await click(browser, `[...document.querySelectorAll("mitra-dialog-settings nav button.page")].find(button => button.textContent.trim() === ${JSON.stringify(ui('Notifications'))})`)
		await shot(`notifications-detail-${theme}`, false, await aroundOpenDialog(browser, 28))
		await press(browser, ...keys.escape())

		// The AI page as a server people sign in to shows it, with its two tokens dated as if made a while back.
		const day = 24 * 60 * 60 * 1000
		const dated = new Map([['Claude', [12 * day, day / 12]], ['Cursor', [3 * day, undefined]]] as const)
		const signedOut = await rewriteAnswers(browser, {
			'/api/meta': meta => ({ ...meta, signIn: true }),
			'/api/user/access-tokens': (tokens: Array<{ name: string }>) => tokens.map(token => {
				const [created, used] = dated.get(token.name as 'Claude')!
				return { ...token, createdAt: new Date(capturedAt.moment - created).toISOString(), lastUsedAt: used && new Date(capturedAt.moment - used).toISOString() }
			}),
		})
		await reopen(theme)
		await press(browser, ...keys.comma())
		await click(browser, `[...document.querySelectorAll("mitra-dialog-settings nav button.page")].find(button => button.textContent.trim() === ${JSON.stringify(ui('AI'))})`)
		await waitFor(() => browser.evaluate<boolean>('return document.querySelectorAll("mitra-access-tokens li").length === 2'), 'the access tokens')
		// The address as the docs write it, not the harness's own port.
		await browser.evaluate('document.querySelector("mitra-mcp-connection code").textContent = "https://mitra.example.com/api/mcp"')
		await shot(`ai-connectors-detail-${theme}`, false, await aroundOpenDialog(browser, 28))
		await press(browser, ...keys.escape())
		await signedOut()
		await reopen(theme)
		await show(browser, 'week')
		await scrollToMorning(browser)

		// A series opens from its chip: the palette lists it once, at its first occurrence.
		await openChip(browser, sample('Weekly Team Sync'))
		await shot(`participants-detail-${theme}`, false, await around(browser, openEditor, details.surface.width, 28))
		await press(browser, ...keys.escape())

		// Its Repeat list open, then the Custom dialog, closed again without a change.
		await openChip(browser, sample('Weekly Team Sync'))
		const repeat = `${openEditor}.querySelector('mitra-repeat-field mitra-select')`
		await click(browser, repeat)
		await shot(`repeat-detail-${theme}`, false, await aroundEditorWith(browser, `${repeat}.shadowRoot.querySelector('mitra-listbox')`, 28))
		await click(browser, `[...${repeat}.querySelectorAll('mitra-option')].find(option => option.textContent.trim() === ${JSON.stringify(ui('Custom…'))})`)
		await shot(`repeat-custom-detail-${theme}`, false, await aroundOpenDialog(browser, 28))
		await press(browser, ...keys.escape())
		await press(browser, ...keys.escape())

		await openFound(browser, sample('Declutter the Flat'))
		await shot(`hierarchy-detail-${theme}`, false, await around(browser, openEditor, details.surface.width, 28))
		await press(browser, ...keys.escape())

		await openFound(browser, sample('Prepare Q3 Presentation'))
		await shot(`due-detail-${theme}`, false, await around(browser, openEditor, details.surface.width, 28))
		await press(browser, ...keys.escape())

		// Its notes link into an Obsidian vault: the Links row above the description, and the link within it.
		await openFound(browser, sample('DA: Study Dynamic Programming'))
		await shot(`links-detail-${theme}`, false, await around(browser, openEditor, details.surface.width, 28))
		await press(browser, ...keys.escape())

		// Monday's architecture draft with three files, the sketch shown in the description: the paperclip on its chip, and the
		// row in its editor beside it. Taken away again after.
		const drafted = sample('Draft New System Architecture')
		await attachToSample(origin, drafted, sampleAttachments, 'Whiteboard sketch.png')
		await reopen(theme)
		await show(browser, 'week')
		await scrollToMorning(browser)
		await openChip(browser, drafted)
		await shot(`attachments-detail-${theme}`, false, await aroundEditorWith(browser, chipOf(drafted), 28))
		await press(browser, ...keys.escape())
		await attachToSample(origin, drafted, [])

		// A new entry, searched for a place and never saved: the reload below discards it, so no run's search becomes the next one's recent.
		await press(browser, ...keys.create())
		await waitFor(() => browser.evaluate<boolean>(`return !!${openEditor}`), 'the editor of a new entry')
		await click(browser, 'document.querySelector("mitra-location-field textarea")')
		await browser.send('Input.insertText', { text: 'Geneva' })
		await waitFor(() => browser.evaluate<boolean>('return document.querySelectorAll("mitra-location-field mitra-option").length >= 6'), 'location suggestions')
		await browser.evaluate('await new Promise(resolve => setTimeout(resolve, 400))')
		await shot(`location-detail-${theme}`, false, await aroundEditorWith(browser, 'document.querySelector("mitra-location-field mitra-listbox")', 28))

		// A new entry given another zone in its editor, never saved: the reload throws it away again.
		await reopen(theme)
		await press(browser, ...keys.create())
		await waitFor(() => browser.evaluate<boolean>(`return !!${openEditor}`), 'the editor of a new entry')
		// 11:00 in Lisbon is 12:00 in Berlin: the entry, and its editor with it, stay in the part of the day on screen.
		await click(browser, `${openEditor}.querySelector('.zone-label')`)
		await pickZone(browser, 'Lisbon')
		await waitFor(() => browser.evaluate<boolean>(`return !!${openEditor}.querySelector('.lens')`), 'the time zone switch')
		await settle(browser)
		await browser.evaluate('await new Promise(resolve => setTimeout(resolve, 600))')
		await shot(`time-zone-detail-${theme}`, false, await around(browser, openEditor, details.surface.width, 28))

		// A zone added to the week through its own ＋, then taken away again: the zones belong to the account.
		await reopen(theme)
		await show(browser, 'week')
		await scrollToMorning(browser)
		await click(browser, 'document.querySelector("mitra-time-zone-header .add")')
		await pickZone(browser, 'New York')
		await waitFor(() => browser.evaluate<boolean>('return !!document.querySelector("mitra-time-zone-header [data-alternative]")'), 'the extra time zone column')
		await settle(browser)
		await shot(`time-zones-detail-${theme}`, false, await detail(browser, details.sidebar))
		// Gone before the next theme's pass, where picking a zone already added would take it away instead.
		await browser.evaluate(`await fetch('/api/user/time-zones/${encodeURIComponent('America/New_York')}', { method: 'DELETE' })`)

		// Last, and the only one with availability shown. A tap on the label reaches the window beneath, as a reader's would.
		await reopen(theme, { availability: true })
		await browser.evaluate('document.documentElement.dataset.scene = "availability"')
		await shot(`availability-detail-${theme}`, false, await aroundHomeOffice(browser, language))
		await click(browser, `${homeOfficeIn(language)}.querySelector('.label')`)
		await editorOpened(browser, sample('Home office'))
		await shot(`availability-editor-detail-${theme}`, false, await around(browser, openEditor, details.surface.width, 28))
		await press(browser, ...keys.escape())
		await browser.evaluate('delete document.documentElement.dataset.scene')
	}

	const folder = outDirOf(language)
	consola.success(`Wrote ${fs.readdirSync(folder).filter(name => name.endsWith('.webp')).length} images to ${path.relative(process.cwd(), folder).replaceAll('\\', '/')}`)
}, { language, build: !process.argv.includes('--no-build') })
