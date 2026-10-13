// Browsers expose `crypto.randomUUID` only in secure contexts, so a self-hosted instance opened over plain HTTP
// on a LAN address (anything but localhost) lacks it, and the shared models minting ids crashed the app at boot.
if (typeof crypto.randomUUID !== 'function') {
	crypto.randomUUID = () => {
		const bytes = crypto.getRandomValues(new Uint8Array(16))
		bytes[6] = bytes[6]! & 0x0f | 0x40
		bytes[8] = bytes[8]! & 0x3f | 0x80
		const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
		return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` as ReturnType<Crypto['randomUUID']>
	}
}
