/**
 * The build's identity, baked into every bundle at build time as one `mitra` object (see `define` in
 * scripts/esbuild.ts). Lowercase to stay clear of the `Mitra` application class. Build-time facts
 * only — deployment-time ones (the instance's display name, the server's runtime) live on the
 * authenticated `/api/meta` endpoint instead, because a container's environment isn't known when
 * its image is built.
 */
declare const mitra: {
	/** The version: the tag when the build is exactly on one (`v0.3.0`), a `git describe` string
	 * otherwise (`v0.3.0-14-ga1b2c3d[-dirty]`), or `dev` when neither git nor the MITRA_VERSION
	 * env var can say. */
	readonly version: string
	/** The short commit hash — empty when the build had neither git nor the MITRA_COMMIT env var. */
	readonly commit: string
}
