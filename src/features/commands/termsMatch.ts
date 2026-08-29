/** Case-insensitive multi-term substring match. Every whitespace-separated term in query must appear in haystack. */
export function termsMatch(query: string, haystack: string) {
	const lowered = haystack.toLowerCase()
	return query.trim().toLowerCase().split(/\s+/).every(term => lowered.includes(term))
}
