import { themeStyles } from '../../src/design/theme.css.js'
import { Color } from '../../src/features/sources/Color.js'
import { releaseColors, releaseNotes } from '../../src/features/about/releaseNotes.css.js'

/** The calendar colours, as `--mitra-color-red` and so on. */
const palette = {
	cssText: `:root {\n${Object.entries(Color)
		.filter(([, value]) => typeof value === 'string')
		.map(([name, value]) => `\t--mitra-color-${name.toLowerCase()}: ${value};`)
		.join('\n')}\n}`,
}

/** The release colours on every page, since the list and the homepage show releases too. */
const channels = { cssText: `:root {${releaseColors.cssText}}` }

/** Served to the site as they are, so only add fragments that make sense on a web page. */
export const fragments = [themeStyles, palette, channels]

/** How a release reads, which the app's About dialog wears too; only a release's page imports it. */
export const release = releaseNotes
