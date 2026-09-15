import { join } from 'path'
import fs from 'fs'
import favicons from 'favicons'
import sharp from 'sharp'
import { distDir } from './esbuild.ts'

const themeColor = '#121314'
const safeZoneScale = 0.5
const adaptiveSizes = [192, 512]

const isSurplusMaskable = (src: string) => src.includes('android-chrome-maskable-') && adaptiveSizes.every(size => !src.includes(`-${size}x${size}.`))

function readArtwork(path: string) {
	const source = fs.readFileSync(path, 'utf8')
	const root = /<svg\b[^>]*>/.exec(source)?.[0]
	if (!root) {
		throw new Error(`${path} has no root <svg> element`)
	}
	return {
		viewBox: /viewBox="([^"]*)"/.exec(root)?.[1] ?? '',
		markup: source.slice(source.indexOf(root) + root.length).replace(/<\/svg>\s*$/, ''),
	}
}

function adaptiveLayer(path: string, background?: string) {
	const { viewBox, markup } = readArtwork(path)
	const size = 512
	const side = Math.round(size * safeZoneScale)
	const inset = Math.round((size - side) / 2)
	return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${size} ${size}">
	${background ? `<rect width="${size}" height="${size}" fill="${background}"/>` : ''}
	<svg x="${inset}" y="${inset}" width="${side}" height="${side}" viewBox="${viewBox}">${markup}</svg>
</svg>`)
}

async function writeMonochromeIcons() {
	const layer = adaptiveLayer('assets/mitra-monochrome.svg')
	await Promise.all(adaptiveSizes.map(size => sharp(layer).resize(size, size).png().toFile(join(distDir, `android-chrome-monochrome-${size}x${size}.png`))))
	return adaptiveSizes.map(size => ({
		src: `/android-chrome-monochrome-${size}x${size}.png`,
		sizes: `${size}x${size}`,
		type: 'image/png',
		purpose: 'monochrome',
	}))
}

function writeNotificationBadge() {
	return sharp('assets/mitra-monochrome.svg').resize(96, 96).png().toFile(join(distDir, 'notification-badge.png'))
}

/** Generates single-page HTML shell, PWA manifest, and favicons from assets/mitra.svg. */
export async function writeIndexHtml() {
	fs.mkdirSync(distDir, { recursive: true })

	const generated = await favicons('assets/mitra.svg', {
		appName: 'Mitra',
		appShortName: 'Mitra',
		appDescription: 'One calendar to plan your events and tasks',
		start_url: '/',
		display: 'standalone',
		theme_color: themeColor,
		background: '#ffffff',
		manifestMaskable: adaptiveLayer('assets/mitra.svg', themeColor),
		icons: {
			android: ['android-chrome-192x192.png', 'android-chrome-512x512.png'],
			appleIcon: ['apple-touch-icon.png'],
			favicons: ['favicon.ico', 'favicon-32x32.png'],
			appleStartup: false,
			windows: false,
			yandex: false,
		},
	})
	const [monochromeIcons] = await Promise.all([writeMonochromeIcons(), writeNotificationBadge()])
	for (const { name, contents } of [...generated.images, ...generated.files]) {
		if (name === 'manifest.webmanifest') {
			const manifest = JSON.parse(contents.toString())
			manifest.display_override = ['window-controls-overlay']
			// Omit orientation property so Android respects the user's rotation lock.
			delete manifest.orientation
			manifest.icons = [...manifest.icons.filter(({ src }: { src: string }) => !isSurplusMaskable(src)), ...monochromeIcons]
			fs.writeFileSync(join(distDir, name), JSON.stringify(manifest, null, 2))
			continue
		}
		if (isSurplusMaskable(name)) {
			continue
		}
		fs.writeFileSync(join(distDir, name), contents)
	}

	// Manifest fetched with credentials for cookie-authenticated reverse proxies.
	const head = [
		...generated.html,
		'<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
	].join('\n\t').replace('rel="manifest"', 'rel="manifest" crossorigin="use-credentials"')

	// interactive-widget=resizes-content ensures virtual keyboards resize layout viewport for bottom sheets.
	fs.writeFileSync(join(distDir, 'index.html'), `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0, interactive-widget=resizes-content">
	<title>Mitra</title>
	${head}
	<script type="module" src="/index.js"></script>
	<script></script>
</head>
<body>
</body>
</html>
`.trim())
}
