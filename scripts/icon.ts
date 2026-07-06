import zlib from 'zlib'

/**
 * The app icon — PROVISIONAL, generated instead of designed: a gold calendar-with-a-check glyph
 * (mitra unifies events and tasks; Mithra keeps contracts) on a TRANSPARENT background, so it reads as
 * a shape — not a colored tile — on taskbars, docks and home screens until a real design exists.
 *
 * To ship a designed icon later: drop PNGs into the repo and swap the `iconPng(...)` calls in
 * scripts/esbuild.ts `writeIndexHtml` for `fs.readFileSync` of them (and re-add a full-bleed
 * `purpose: maskable` variant to the manifest — transparent maskables look wrong, so it's omitted
 * for now). Everything else — manifest, index.html links, the notification icon — already points at
 * `/icon-192.png` / `/icon-512.png` and needs no change.
 *
 * Rendering: shapes in unit coordinates — rounded rectangles (fill or erase) and capsules (a segment
 * with thickness, for the check's strokes) — supersampled and encoded as a PNG right here (chunks +
 * zlib are all a PNG needs).
 */

const GOLD: Rgb = [0xd4, 0xa2, 0x4e]

type Rgb = [number, number, number]
type Shape =
	| { kind: 'rect', x0: number, y0: number, x1: number, y1: number, r: number, color: Rgb | null } // null erases
	| { kind: 'capsule', x0: number, y0: number, x1: number, y1: number, thickness: number, color: Rgb }

// Back-to-front; the last shape containing a sample wins (an erase shape punches back to transparent).
const LAYERS: Array<Shape> = [
	{ kind: 'rect', x0: 0.08, y0: 0.14, x1: 0.92, y1: 0.94, r: 0.12, color: GOLD }, // body
	{ kind: 'rect', x0: 0.17, y0: 0.36, x1: 0.83, y1: 0.85, r: 0.05, color: null }, // carve → frame + header band
	{ kind: 'rect', x0: 0.25, y0: 0.03, x1: 0.36, y1: 0.25, r: 0.055, color: GOLD }, // binding tabs
	{ kind: 'rect', x0: 0.64, y0: 0.03, x1: 0.75, y1: 0.25, r: 0.055, color: GOLD },
	{ kind: 'capsule', x0: 0.335, y0: 0.615, x1: 0.45, y1: 0.72, thickness: 0.095, color: GOLD }, // the check
	{ kind: 'capsule', x0: 0.45, y0: 0.72, x1: 0.665, y1: 0.50, thickness: 0.095, color: GOLD },
]

function covers(x: number, y: number, shape: Shape): boolean {
	if (shape.kind === 'capsule') {
		// Distance from the sample to the segment ≤ half the thickness.
		const dx = shape.x1 - shape.x0, dy = shape.y1 - shape.y0
		const t = Math.max(0, Math.min(1, ((x - shape.x0) * dx + (y - shape.y0) * dy) / (dx * dx + dy * dy)))
		const px = x - (shape.x0 + t * dx), py = y - (shape.y0 + t * dy)
		return px * px + py * py <= (shape.thickness / 2) ** 2
	}
	if (x < shape.x0 || x > shape.x1 || y < shape.y0 || y > shape.y1) {
		return false
	}
	const dx = Math.max(shape.x0 + shape.r - x, 0, x - (shape.x1 - shape.r))
	const dy = Math.max(shape.y0 + shape.r - y, 0, y - (shape.y1 - shape.r))
	return dx * dx + dy * dy <= shape.r * shape.r
}

/** The icon as raw RGBA (transparent background), 3×3-supersampled for smooth edges. */
function rasterize(size: number): Buffer {
	const pixels = Buffer.alloc(size * size * 4)
	const samples = 3
	for (let py = 0; py < size; py++) {
		for (let px = 0; px < size; px++) {
			let r = 0, g = 0, b = 0, covered = 0
			for (let sy = 0; sy < samples; sy++) {
				for (let sx = 0; sx < samples; sx++) {
					const x = (px + (sx + 0.5) / samples) / size
					const y = (py + (sy + 0.5) / samples) / size
					let color: Rgb | null = null
					for (const shape of LAYERS) {
						if (covers(x, y, shape)) {
							color = shape.color
						}
					}
					if (color) {
						r += color[0]; g += color[1]; b += color[2]
						covered++
					}
				}
			}
			const offset = (py * size + px) * 4
			if (covered) {
				pixels[offset] = Math.round(r / covered)
				pixels[offset + 1] = Math.round(g / covered)
				pixels[offset + 2] = Math.round(b / covered)
				pixels[offset + 3] = Math.round(covered / (samples * samples) * 255)
			}
		}
	}
	return pixels
}

// --- Minimal PNG encoding (signature + IHDR/IDAT/IEND chunks; scanlines deflate-compressed) ---------

const crcTable = Array.from({ length: 256 }, (_, n) => {
	let c = n
	for (let k = 0; k < 8; k++) {
		c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
	}
	return c >>> 0
})

function crc32(data: Buffer): number {
	let crc = 0xffffffff
	for (const byte of data) {
		crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
	}
	return (crc ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
	const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
	const length = Buffer.alloc(4)
	length.writeUInt32BE(data.length)
	const crc = Buffer.alloc(4)
	crc.writeUInt32BE(crc32(body))
	return Buffer.concat([length, body, crc])
}

/** The mitra app icon as a `size`×`size` PNG. */
export function iconPng(size: number): Buffer {
	const pixels = rasterize(size)
	// One filter byte (0 = None) per scanline, then the raw RGBA bytes.
	const scanlines = Buffer.alloc(size * (1 + size * 4))
	for (let y = 0; y < size; y++) {
		pixels.copy(scanlines, y * (1 + size * 4) + 1, y * size * 4, (y + 1) * size * 4)
	}
	const ihdr = Buffer.alloc(13)
	ihdr.writeUInt32BE(size, 0)
	ihdr.writeUInt32BE(size, 4)
	ihdr[8] = 8 // bit depth
	ihdr[9] = 6 // color type: RGBA
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', ihdr),
		chunk('IDAT', zlib.deflateSync(scanlines, { level: 9 })),
		chunk('IEND', Buffer.alloc(0)),
	])
}
