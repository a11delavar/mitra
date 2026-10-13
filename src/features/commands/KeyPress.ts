/**
 * A key pressed for a shortcut, named as on a Latin keyboard. It is the key the layout types (an AZERTY "W" stays
 * "w", a BÉPO "é" stays "é"), except where the layout writes another script: Persian types "ز" on the C key, so the
 * key's place names it.
 */
export class KeyPress {
	constructor(private readonly event: Pick<KeyboardEvent, 'key' | 'code' | 'shiftKey'>) { }

	get key(): string {
		const { key, code, shiftKey } = this.event
		if (key.length !== 1 || /^[\x20-\x7e]$/.test(key) || /\p{Script=Latin}/u.test(key)) {
			return key
		}
		return /^Key([A-Z])$/.exec(code)?.[1]!.toLowerCase()
			?? /^Digit(\d)$/.exec(code)?.[1]
			?? (code === 'Slash' ? shiftKey ? '?' : '/' : key)
	}

	is(key: string) {
		return this.key.toLowerCase() === key.toLowerCase()
	}
}
