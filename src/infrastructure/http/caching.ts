import path from 'node:path'

/** esbuild names chunks and assets by their content (`chunk-G5TDAYEW.js`), so a new build never reuses such a name. */
const contentNamed = /-[A-Z0-9]{8}\.[a-z0-9]+(\.(br|gz))?$/

/**
 * How long a browser may keep a frontend file. A content-named file never changes, so forever. Every other one (the
 * shell, `index.js`, the manifest, the service worker, a release's notes) is asked about again on every load, which an
 * unchanged file answers with a bare 304: a proxy such as Cloudflare stretches a mere `max-age=0` to hours, so after a
 * deploy browsers kept running the previous app against the new server.
 */
export function cacheControlOf(file: string) {
	return contentNamed.test(path.basename(file)) ? 'public, max-age=31536000, immutable' : 'no-cache'
}
