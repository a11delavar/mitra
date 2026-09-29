import { icons } from 'lucide'

const pascalCase = name => name.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('')

function serialize([tag, attributes, children = []]) {
	const rendered = Object.entries(attributes).map(([key, value]) => ` ${key}="${value}"`).join('')
	return children.length === 0
		? `<${tag}${rendered}/>`
		: `<${tag}${rendered}>${children.map(serialize).join('')}</${tag}>`
}

/** The lucide glyph as `src/design/Icon.ts` draws it. */
export function iconSvg(name, { size = '1em', strokeWidth = 2, fill = 'none', ...extra } = {}) {
	const node = icons[pascalCase(name)]
	if (!node) {
		throw new Error(`Unknown lucide icon: ${name}`)
	}
	const [tag, attributes, children] = node
	return serialize([tag, {
		...attributes,
		width: size,
		height: size,
		fill,
		stroke: 'currentColor',
		'stroke-width': strokeWidth,
		'stroke-linecap': 'round',
		'stroke-linejoin': 'round',
		...extra,
	}, children])
}

/** The glyph as a `mask-image` URL, for icons CSS tints with `currentColor`. */
export function iconMask(name, options) {
	const svg = iconSvg(name, { size: 24, ...options })
	return `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27').replace(/"/g, '%22')}")`
}
