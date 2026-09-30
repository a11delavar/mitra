import { themeStyles } from '../../src/design/theme.css.js'
import { Color } from '../../src/features/sources/Color.js'

/** The calendar colours, as `--mitra-color-red` and so on. */
const palette = {
	cssText: `:root {\n${Object.entries(Color)
		.filter(([, value]) => typeof value === 'string')
		.map(([name, value]) => `\t--mitra-color-${name.toLowerCase()}: ${value};`)
		.join('\n')}\n}`,
}

/** Served to the site as they are, so only add fragments that make sense on a web page. */
export const fragments = [themeStyles, palette]
