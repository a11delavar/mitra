export class Color {
	static readonly palette: ReadonlyArray<string> = [
		'#eb5a5a', // Red
		'#e58b4b', // Orange
		'#f9c344', // Yellow
		'#63d18d', // Green
		'#51ace3', // Blue
		'#9b61f9', // Purple
		'#b4b4b4', // Grey
	]

	static get(identifier: string): Color {
		let hash = 0
		for (let i = 0; i < identifier.length; i++) {
			hash = identifier.charCodeAt(i) + ((hash << 5) - hash)
		}
		return new Color(Color.palette[Math.abs(hash) % Color.palette.length]!);
	}

	constructor(readonly value: string) { }
}
