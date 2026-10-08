export class Color {
	static readonly Red = '#eb5a5a'
	static readonly Orange = '#e58b4b'
	static readonly Yellow = '#f9c344'
	static readonly Green = '#63d18d'
	static readonly Blue = '#51ace3'
	static readonly Purple = '#9b61f9'
	static readonly Grey = '#b4b4b4'

	static readonly palette: ReadonlyArray<string> = [
		Color.Red,
		Color.Orange,
		Color.Yellow,
		Color.Green,
		Color.Blue,
		Color.Purple,
		Color.Grey,
	]

	/** The first preset none of `taken` uses, starting at green, so each new calendar gets its own. */
	static unusedAmong(taken: Iterable<string | null | undefined>): string {
		const used = new Set(taken)
		const start = Color.palette.indexOf(Color.Green)
		const rotation = [...Color.palette.slice(start), ...Color.palette.slice(0, start)]
		return rotation.find(color => !used.has(color)) ?? rotation[used.size % rotation.length]!
	}

	static get(identifier: string): Color {
		let hash = 0
		for (let i = 0; i < identifier.length; i++) {
			hash = identifier.charCodeAt(i) + ((hash << 5) - hash)
		}
		return new Color(Color.palette[Math.abs(hash) % Color.palette.length]!)
	}

	constructor(readonly value: string) { }
}
