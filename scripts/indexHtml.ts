import { join } from 'path'
import fs from 'fs'
import favicons from 'favicons'
import { distDir } from './esbuild.ts'

/** Generates single-page HTML shell, PWA manifest, and favicons from assets/mitra.svg. */
export async function writeIndexHtml() {
	fs.mkdirSync(distDir, { recursive: true })

	const generated = await favicons('assets/mitra.svg', {
		appName: 'Mitra',
		appShortName: 'Mitra',
		appDescription: 'One calendar to plan your events and tasks',
		start_url: '/',
		display: 'standalone',
		theme_color: '#121314',
		background: '#ffffff',
		icons: {
			android: ['android-chrome-192x192.png', 'android-chrome-512x512.png'],
			appleIcon: ['apple-touch-icon.png'],
			favicons: ['favicon.ico', 'favicon-32x32.png'],
			appleStartup: false,
			windows: false,
			yandex: false,
		},
	})
	for (const { name, contents } of [...generated.images, ...generated.files]) {
		if (name === 'manifest.webmanifest') {
			const manifest = JSON.parse(contents.toString())
			manifest.display_override = ['window-controls-overlay']
			// Omit orientation property so Android respects the user's rotation lock.
			delete manifest.orientation
			fs.writeFileSync(join(distDir, name), JSON.stringify(manifest, null, 2))
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
