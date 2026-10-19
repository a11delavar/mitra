import {
	aroundEditorWith, attachToSample, reducedMotion, chipOf, type Clip, click, type Devtools, keys, openChip, openEditor, openFound, press, sampleAttachments,
	scrollToMorning, settle, show, waitFor,
} from '../../scripts/capture.ts'
import { middleOf, type Point } from '../../scripts/film.ts'
import { film, still } from '../../scripts/scenes.ts'

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

/** An AI connector's call, as Claude or Cursor sends it to the address: plain JSON-RPC, answered with the tool's data. */
async function callTool<Data = Record<string, unknown>>(origin: string, name: string, args: Record<string, unknown> = {}): Promise<Data> {
	const response = await fetch(`${origin}api/mcp`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
		body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
	})
	const text = await response.text()
	const message = text.split('\n').findLast(line => line.startsWith('data:'))?.slice(5) ?? text
	const { result, error } = JSON.parse(message) as { result?: { isError?: boolean, content: Array<{ text: string }>, structuredContent: Data }, error?: { message: string } }
	if (!result || result.isError) {
		throw new Error(`${name} refused: ${error?.message ?? result?.content[0]?.text}`)
	}
	return result.structuredContent
}

/** The Eiffel Tower's notes, about the tower itself, with its photo from Wikimedia Commons (CC BY 2.0, credited in the release notes). */
const eiffelPhoto = 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Eiffel_Tower_from_the_Tour_Montparnasse_3%2C_Paris_May_2014.jpg/960px-Eiffel_Tower_from_the_Tour_Montparnasse_3%2C_Paris_May_2014.jpg'
const eiffelNotes = 'The wrought-iron tower built for the 1889 World’s Fair, 330 metres tall. Lifts climb to the summit at 276 metres, over the Seine and the Champ de Mars; the second floor has the finest view of the city.\n\n'
	+ `![The Eiffel Tower over the Champ de Mars](${eiffelPhoto})`

/** The tickets as the booking mails them: a one-page PDF with its code, written out by hand so the capture needs no PDF library. */
function ticketPdf() {
	// A QR-like code of 29 modules, 16 pixels each, uncompressed as a mailed ticket's scan often is: about 200 kB.
	const modules = 29
	const scale = 16
	const size = modules * scale
	let seed = 1889
	const dark = Array.from({ length: modules * modules }, (_, index) => {
		const row = Math.floor(index / modules)
		const column = index % modules
		for (const [top, left] of [[0, 0], [0, modules - 7], [modules - 7, 0]]) {
			const y = row - top!
			const x = column - left!
			if (y >= 0 && y < 7 && x >= 0 && x < 7) {
				return y === 0 || y === 6 || x === 0 || x === 6 || (y >= 2 && y <= 4 && x >= 2 && x <= 4)
			}
		}
		seed = (seed * 1103515245 + 12345) % 2147483648
		return seed % 2 === 0
	})
	let pixels = ''
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			pixels += dark[Math.floor(y / scale) * modules + Math.floor(x / scale)] ? '\x00' : '\xff'
		}
	}
	const lines = ['Eiffel Tower', 'Summit ticket, 2 adults', 'Thursday 8 July 2027, 09:30', 'Entrance: south pillar']
	const text = lines.map((line, index) => `BT /F1 ${index ? 14 : 24} Tf 72 ${760 - index * 28} Td (${line}) Tj ET`).join('\n') + '\nq 232 0 0 232 72 400 cm /Code Do Q'
	const objects = [
		'<< /Type /Catalog /Pages 2 0 R >>',
		'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
		'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> /XObject << /Code 6 0 R >> >> >>',
		`<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
		'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
		`<< /Type /XObject /Subtype /Image /Width ${size} /Height ${size} /ColorSpace /DeviceGray /BitsPerComponent 8 /Length ${pixels.length} >>\nstream\n${pixels}\nendstream`,
	]
	let pdf = '%PDF-1.4\n'
	const offsets = objects.map((object, index) => {
		const offset = pdf.length
		pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
		return offset
	})
	const xref = pdf.length
	pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`
	pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
	return Promise.resolve(Buffer.from(pdf, 'latin1'))
}

interface Row {
	readonly id: string
	readonly heading: string
	readonly start: string
	readonly end?: string
	readonly occurrence?: string
}

/** What a film shows of the plan as it is written: an entry about to leave the week and gone, one arrived, the links drawn. */
interface Beats {
	leaving?(heading: string, day: number): Promise<void>
	left?(heading: string, day: number): Promise<void>
	arrived?(heading: string, day: number): Promise<void>
	linked?(): Promise<void>
}

/** Whether the trip's entries are its subtasks: each draws a line from the trip's bar, which crowds the week. */
const subtasks = false

const at = (day: number, time: string) => `2027-07-${String(day).padStart(2, '0')}T${time}[Europe/Berlin]`

/**
 * The trip a chat planned, written into the sample as an AI connector would: next week's gym and clashes cleared, the trip with its
 * flights, plans and to-dos in Hobbies, the flight waiting for the online check-in and the sights for their tickets.
 */
async function planParis(origin: string, text: (english: string) => string, beats: Beats = {}) {
	const { calendars } = await callTool<{ calendars: Array<{ id: string, name: string }> }>(origin, 'get_context')
	const hobbies = calendars.find(calendar => calendar.name === text('Hobbies'))!.id
	const { entries } = await callTool<{ entries: Array<Row> }>(origin, 'get_overview', { start: '2027-07-05', end: '2027-07-11' })
	const find = (heading: string, day: number) => entries.find(entry => entry.heading === text(heading) && new Date(entry.start).getUTCDate() === day)!

	for (const [heading, day] of [['💪 Gym', 5], ['💪 Gym', 7], ['🏐 Volleyball', 8], ['💪 Gym', 9], ['🛒 Grocery Shopping', 10]] as const) {
		const occurrence = find(heading, day)
		await beats.leaving?.(text(heading), day)
		await callTool(origin, 'delete_entry_occurrence', { id: occurrence.id, occurrence: occurrence.occurrence, scope: 'this' })
		await beats.left?.(text(heading), day)
	}
	const dinner = find('Dinner with friends', 9)
	await beats.leaving?.(text('Dinner with friends'), 9)
	await callTool(origin, 'update_entry', { id: dinner.id, start: at(5, '19:00'), end: at(5, '22:00'), location: null })
	await beats.arrived?.(text('Dinner with friends'), 5)

	const create = async (heading: string, fields: Record<string, unknown>) => {
		const { id } = await callTool<{ id: string }>(origin, 'create_entry', { heading, sourceId: hobbies, ...fields })
		await beats.arrived?.(heading, Number(String(fields['start']).slice(8, 10)))
		return id
	}
	const trip = await create('🥐 Paris trip', { start: '2027-07-07', end: '2027-07-11', allDay: true, location: 'Paris' })
	// Underway: the tower's tickets are booked and attached to it, the museum and the palace are still to do.
	const tickets = await create('🎟️ Book tickets', { type: 'task', status: 'doing', start: at(5, '18:00'), end: at(5, '18:30'), description: '- [x] Eiffel Tower\n- [ ] Louvre\n- [ ] Versailles' })
	const checkIn = await create('📱 Online check-in', { type: 'task', start: at(6, '12:30'), end: at(6, '13:00') })
	const pack = await create('🧳 Pack', { type: 'task', start: at(6, '20:00'), end: at(6, '20:45'), description: '- [ ] Light jacket\n- [ ] Umbrella\n- [ ] Passports\n- [ ] Chargers' })
	const out = await create('✈️ Flight to Paris', { start: at(7, '09:40'), end: at(7, '11:25'), location: 'BER → CDG' })
	const hotel = await create('🏨 Hotel check-in', { start: at(7, '14:00'), end: at(7, '14:45'), location: 'Rue de Bretagne, Le Marais' })
	const montmartre = await create('⛪ Montmartre', { start: at(7, '16:00'), end: at(7, '18:30'), location: 'Sacré-Cœur, Montmartre' })
	const eiffel = await create('🗼 Eiffel Tower', { start: at(8, '09:30'), end: at(8, '11:00'), location: 'Champ de Mars', description: eiffelNotes })
	const louvre = await create('🖼️ Louvre', { start: at(8, '13:00'), end: at(8, '16:30'), location: 'Rue de Rivoli' })
	const cruise = await create('🚢 Seine cruise', { start: at(8, '19:30'), end: at(8, '20:30'), location: 'Port de la Bourdonnais' })
	const versailles = await create('👑 Versailles', { start: at(9, '09:00'), end: at(9, '17:00'), location: 'Château de Versailles, Place d’Armes' })
	const checkOut = await create('🏨 Hotel check-out', { start: at(10, '11:00'), end: at(10, '11:45'), location: 'Rue de Bretagne, Le Marais' })
	const back = await create('✈️ Flight back to Berlin', { start: at(10, '17:30'), end: at(10, '19:15'), location: 'CDG → BER' })

	const relate = (id: string, type: 'PARENT' | 'FINISHTOSTART', target: string) => callTool(origin, 'relate_entries', { id, type, target })
	if (subtasks) {
		for (const id of [tickets, checkIn, pack, out, hotel, montmartre, eiffel, louvre, cruise, versailles, checkOut, back]) {
			await relate(id, 'PARENT', trip)
		}
	}
	await attachToSample(origin, '🗼 Eiffel Tower', [{ name: 'Eiffel Tower tickets.pdf', type: 'application/pdf', bytes: ticketPdf }])

	// Only what truly waits: the flight for the online check-in, the sights for their tickets.
	for (const [dependent, prerequisite] of [[out, checkIn], [eiffel, tickets], [louvre, tickets], [versailles, tickets]]) {
		await relate(dependent!, 'FINISHTOSTART', prerequisite!)
	}
	await beats.linked?.()
}

/** Next week in the week view, from the first trip entry to the last flight in view. */
async function nextWeek(browser: Devtools) {
	await show(browser, 'week')
	// From seven to midnight in one window, so the evenings show and Friday to Sunday after the last flight is empty under the
	// chat: set on the view itself, as a reload would drop the captures' own stylesheet.
	await browser.evaluate(`
		const density = document.querySelector('mitra-days').density
		density.zoom = density.target = 1.41
		density.apply()
		await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
	`)
	await settle(browser)
	await browser.evaluate(`
		const calendar = document.querySelector('mitra-page-calendar')
		calendar.step(1)
		await calendar.updateComplete
	`)
	await waitFor(() => browser.evaluate<boolean>(`return [...document.querySelectorAll('mitra-day')].some(day => new Date(day.dataset.date).getDate() === 7)`), 'next week')
	await scrollToMorning(browser)
	await browser.evaluate('await new Promise(resolve => setTimeout(resolve, 800))')
}

/** A conversation as the chat beside Mitra shows it: who said what, and where the AI connector stepped in. */
interface Message {
	readonly from: 'user' | 'assistant'
	readonly text: string
	/** The connector's work shown above an answer, as chats show a tool they used. */
	readonly used?: string
}

/** The last turn of the planning chat: the command, and the answer once the connector has written the week. */
const lastTurn: ReadonlyArray<Message> = [
	{ from: 'user', text: 'That plan is perfect. Can you put it all into my calendar, the bookings too? And cancel whatever I had planned while we’re away.' },
	{ from: 'assistant', used: 'Mitra', text: 'Done. Your Paris trip is in your Hobbies calendar: both flights, the hotel, Montmartre, the Eiffel Tower, the Louvre, the Seine cruise and Versailles, with to-dos for the tickets, the online check-in and packing. I cancelled the gym, volleyball and groceries that week, and moved dinner with friends to Monday.' },
]

/**
 * The chat as an overlay, part of no interface: Mitra ends short of the window's edge and fades into a band, from which
 * the last turn floats over it. Outgoing messages are solid and indented from the start, incoming ones light and indented
 * from the end, as chats tell them apart.
 */
async function chatOver(browser: Devtools, messages: ReadonlyArray<Message>) {
	await browser.evaluate(`
		document.querySelector('mitra-page-calendar').sidebarOpen = false
		const style = document.createElement('style')
		style.textContent = ${JSON.stringify(`
			html { background: light-dark(#e7e3dd, #121110); }
			body { background: transparent; }
			mitra-page-calendar { inset-inline-end: 12rem !important; }
			#capture-fade {
				position: fixed; inset-block: 0; inset-inline-end: 12rem; inline-size: 18rem; pointer-events: none;
				background: linear-gradient(to right, transparent, light-dark(#e7e3dd, #121110));
			}
			#capture-chat {
				position: fixed; inset-block-end: 1.5rem; inset-inline-end: 1.5rem; pointer-events: none;
				display: flex; flex-direction: column; gap: 0.625rem;
				font-family: system-ui, sans-serif; font-size: 1rem; line-height: 1.45;
			}
			#capture-chat > div { padding: 0.75rem 1rem; border-radius: 16px; box-shadow: 0 18px 40px -14px rgb(0 0 0 / 0.4); }
			#capture-chat > .user {
				align-self: flex-end; margin-inline-start: 2rem; border-end-end-radius: 6px;
				background: light-dark(#26231f, #f1ece5); color: light-dark(#f7f3ee, #1d1b19);
			}
			#capture-chat > .assistant, #capture-chat > .used {
				align-self: flex-start; margin-inline-end: 2rem;
				background: light-dark(#ffffff, #2c2925); color: light-dark(#1d1b19, #f3efe9);
				outline: 1px solid light-dark(rgb(0 0 0 / 0.06), rgb(255 255 255 / 0.08));
			}
			#capture-chat > .assistant { border-end-start-radius: 6px; }
			#capture-chat > .used {
				display: inline-flex; align-items: center; gap: 0.5rem; margin-block-start: 0.5rem; padding: 0.25rem 0.75rem;
				border-radius: 999px; font-size: 0.875rem;
			}
			#capture-chat img { inline-size: 1rem; block-size: 1rem; }
			#capture-chat > * { animation: capture-arrive 0.3s ease-out both; }
			@keyframes capture-arrive { from { opacity: 0; translate: 0 0.5rem; } }
		`)}
		document.head.append(style)
		const fade = document.createElement('div')
		fade.id = 'capture-fade'
		const chat = document.createElement('aside')
		chat.id = 'capture-chat'
		// A film adds the messages one by one: the connector's chip, then its bubble, each handed back to fill.
		window.captureUsed = text => {
			const used = document.createElement('div')
			used.className = 'used'
			used.innerHTML = '<img src="/favicon-32x32.png" alt=""><span></span>'
			used.lastChild.textContent = text
			chat.append(used)
			return used.lastChild
		}
		window.captureSay = (from, text) => {
			const bubble = document.createElement('div')
			bubble.className = from
			bubble.textContent = text
			chat.append(bubble)
			return bubble
		}
		for (const message of ${JSON.stringify(messages)}) {
			if (message.used) {
				captureUsed('Used ' + message.used)
			}
			captureSay(message.from, message.text)
		}
		document.body.append(fade, chat)
		await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
		// The narrower calendar shows fewer days around its date: moved until Monday leads, measured once the view rests.
		const calendar = document.querySelector('mitra-page-calendar')
		const days = document.querySelector('mitra-days')
		const rest = async () => {
			for (let still = 0, last; still < 3; still = days.scrollLeft === last ? still + 1 : 0) {
				last = days.scrollLeft
				await new Promise(resolve => setTimeout(resolve, 200))
			}
		}
		const lead = () => {
			const axis = days.querySelector('.axis').getBoundingClientRect().right
			return new Date([...days.querySelectorAll('mitra-day')].find(day => day.getBoundingClientRect().left >= axis - 2).dataset.date).getDate()
		}
		await rest()
		for (let attempt = 0; attempt < 4 && lead() !== 5; attempt++) {
			calendar.navigatingDate = calendar.navigatingDate.add({ days: 5 - lead() })
			await calendar.updateComplete
			await rest()
		}
		await rest()
		if (lead() !== 5) {
			throw new Error('The week does not start on Monday the 5th beside the chat')
		}
		// From Saturday's edge on: the cards cover the faded, empty Sunday and the band, never the trip.
		const saturday = [...days.querySelectorAll('mitra-day')].find(day => new Date(day.dataset.date).toDateString() === new Date(2027, 6, 10).toDateString())
		chat.style.inlineSize = (innerWidth - saturday.getBoundingClientRect().right - 16 - 24) + 'px'
	`)
	await settle(browser)
	await scrollToMorning(browser)
}

/** A summer trip: the clock stands on Thursday 1 July 2027, which lays the sample week out as 1 October 2026 does. */
const summer = Date.parse('2027-07-01T10:20:00+02:00')

/**
 * The connector at work, over the week the chat sits beside: the message typed, the week cleared one entry after
 * another, the trip arriving entry by entry with its links, the answer, and the Eiffel Tower opened with its ticket.
 */
film('connectors', { moment: summer }, async ({ browser, origin, open, text, record }) => {
	// Laid out without motion, as a still is: the week's moves would scroll smoothly and fool the measuring.
	await reducedMotion(browser, true)
	await open()
	await nextWeek(browser)
	await chatOver(browser, [])
	await reducedMotion(browser, false)
	// The photo comes from Wikimedia: fetched now, so the editor shows it the moment it opens.
	await browser.evaluate(`
		await new Promise(resolve => Object.assign(new Image(), { onload: resolve, onerror: resolve, src: ${JSON.stringify(eiffelPhoto)} }))
		window.captureChip = (heading, day) => [...document.querySelectorAll('mitra-entry-segment')].find(segment => {
			const host = segment.closest('mitra-day')
			return segment.textContent.includes(heading) && (!host || new Date(host.dataset.date).toDateString() === new Date(2027, 6, day).toDateString())
		})
		for (const segment of document.querySelectorAll('mitra-entry-segment')) {
			segment.dataset.captureWas = ''
		}
		const style = document.createElement('style')
		style.textContent = 'mitra-entry-segment:not([data-capture-was]) { animation: capture-landed 0.45s ease-out both } @keyframes capture-landed { from { opacity: 0; scale: 0.92 } }'
		document.head.append(style)
	`)
	const chip = (heading: string, day: number) => `captureChip(${JSON.stringify(heading)}, ${day})`
	// The pointer rests in the band above the chat, as if it had just sent the message.
	const park = await browser.evaluate<Point>('const chat = document.getElementById("capture-chat").getBoundingClientRect(); return { x: chat.right - 40, y: chat.bottom - 180 }')

	const first = await browser.evaluate<string>(`
		const axis = document.querySelector('mitra-days .axis').getBoundingClientRect().right
		return [...document.querySelectorAll('mitra-day')].find(day => day.getBoundingClientRect().left >= axis - 2).dataset.date
	`)
	if (new Date(first).getDate() !== 5) {
		throw new Error(`The film's week starts on ${first}, not Monday the 5th`)
	}
	const recording = record()
	await recording.start()
	await recording.hold(park, 0.5)

	const [ask, answer] = lastTurn as [Message, Message]
	await browser.evaluate(`window.captureBubble = captureSay('user', '')`)
	for (let typed = 3; typed < ask.text.length + 3; typed += 3) {
		await browser.evaluate(`captureBubble.textContent = ${JSON.stringify(ask.text.slice(0, typed))}`)
		await recording.hold(park, 1 / 30)
	}
	await recording.hold(park, 0.4)
	await browser.evaluate(`window.captureWorking = captureUsed('Using ${answer.used}…')`)
	await recording.hold(park, 0.3)

	await planParis(origin, text, {
		leaving: async (heading, day) => {
			await browser.evaluate(`Object.assign(${chip(heading, day)}.style, { transition: 'opacity 0.35s, scale 0.35s', opacity: '0', scale: '0.92' })`)
			await recording.hold(park, 0.3)
		},
		left: (heading, day) => recording.until(`return !${chip(heading, day)}`, `${heading} gone from the ${day}th`),
		arrived: async (heading, day) => {
			await recording.until(`return !!${chip(heading, day)}`, `${heading} on the ${day}th`)
			await recording.hold(park, 0.15)
		},
		linked: () => recording.hold(park, 0.6),
	})

	await browser.evaluate(`captureWorking.textContent = 'Used ${answer.used}'; window.captureBubble = captureSay('assistant', '')`)
	const words = answer.text.split(' ')
	for (let said = 2; said < words.length + 2; said += 2) {
		await browser.evaluate(`captureBubble.textContent = ${JSON.stringify(words.slice(0, said).join(' '))}`)
		await recording.hold(park, 1 / 30)
	}
	await recording.hold(park, 1.2)

	// The chat steps aside, and the tower opens: its photo, its notes and the ticket beside them.
	await browser.evaluate(`Object.assign(document.getElementById('capture-chat').style, { transition: 'opacity 0.5s', opacity: '0' })`)
	const eiffel = await middleOf(browser, chipOf('🗼 Eiffel Tower'))
	await recording.move(park, eiffel, 0.8)
	await recording.hold(eiffel, 0.2)
	await recording.press(eiffel)
	await recording.release(eiffel)
	await recording.until(`return !!${openEditor}`, 'the Eiffel Tower open')
	await recording.hold(eiffel, 1.8)
	await recording.stop()
})
