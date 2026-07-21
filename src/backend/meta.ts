import { Router } from 'express'
import { updateChecker } from './updates.js'

export const metaRouter = Router()

/** What this instance calls itself — self-hosters rebrand via MITRA_NAME (see the README). Display
 * only: the sidebar's brand row and the browser tab; the installed-app (manifest) identity is baked
 * at build time and stays Mitra. */
const instanceName = process.env.MITRA_NAME || 'Mitra'

/**
 * Instance metadata for the frontend's brand row and About dialog. Mounted BEHIND the auth wall on
 * purpose: the version is exactly the fingerprinting detail the public health probe deliberately
 * withholds (see health.ts) — only signed-in users get to know what's running.
 */
metaRouter.get('/', (_req, res) => {
	return res.json({
		name: instanceName,
		version: mitra.version,
		commit: mitra.commit,
		node: process.version,
		// Present only when the update checker has found something newer — the SERVER polls GitHub
		// (one poll per instance, see updates.ts), the browser merely renders this cached verdict.
		...(updateChecker.update ? { update: updateChecker.update } : {}),
	})
})
