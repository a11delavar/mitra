import { join } from 'path'
import fs from 'fs'
import favicons from 'favicons'
import { distDir } from './esbuild.ts'

/** The single-page shell that boots the bundled frontend, plus the PWA statics — every icon, the web
 * app manifest (installability: what lets push notifications attribute to "Mitra" instead of the
 * browser, and what iOS requires for push at all), and the <head> links referencing them — all derived
 * from the ONE logo file, `assets/mitra.svg`. Replacing that file and rebuilding rebrands everything. */
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
		// Only the icons something actually consumes: install + notifications (Android/Chromium),
		// the iOS home screen, and the browser tab. No maskable variant on purpose: the provisional
		// logo is a transparent glyph, and a transparent maskable renders as a blob on a white disc.
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
		// `favicons` has no option for `display_override`, so patch it into the generated manifest:
		// browsers that support Window Controls Overlay drop the title bar and let the app paint into
		// it, while others fall back to plain `display: standalone`.
		if (name === 'manifest.webmanifest') {
			const manifest = JSON.parse(contents.toString())
			manifest.display_override = ['window-controls-overlay']
			// `favicons` defaults `orientation` to "any", which is NOT the same as leaving it out: Chromium
			// bakes the manifest's orientation into the installed WebAPK's `android:screenOrientation`, and
			// "any" lands on a sensor-family value that follows the accelerometer even when the phone's
			// auto-rotate is locked. Omitting the member sends "" instead — Android's `unspecified` — which
			// is what respects the user's rotation lock. Mitra wants both orientations, so: no member.
			delete manifest.orientation
			fs.writeFileSync(join(distDir, name), JSON.stringify(manifest, null, 2))
			continue
		}
		fs.writeFileSync(join(distDir, name), contents)
	}

	// The manifest must be fetched WITH credentials: browsers omit cookies on manifest requests by
	// default (per spec), so behind a cookie-auth proxy (e.g. Traefik OIDC) the request 302s to the
	// login page and installability silently dies — no manifest, no install prompt, no "Install App".
	// The apple-touch-icon link is appended by hand — favicons drops it when the icon set is filtered.
	const head = [
		...generated.html,
		'<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
	].join('\n\t').replace('rel="manifest"', 'rel="manifest" crossorigin="use-credentials"')

	// interactive-widget picks the on-screen keyboard's policy, and the default (resizes-visual) is
	// wrong for an app whose layout is viewport-bound CSS: the keyboard then resizes NOTHING — it pans
	// the visual viewport instead — so every dv* unit keeps meaning the full screen and the bottom
	// sheet (sized in dvb, see components/sheet.ts) lays out as if the keyboard weren't there, typing
	// under it. resizes-content shrinks the layout viewport itself: the dv* units follow, the sheet
	// clears the keyboard, and there is no pan to slide the header off — all without a line of script.
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
