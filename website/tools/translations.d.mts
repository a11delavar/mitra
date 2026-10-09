/** What translations.mjs exports, for the i18n check, which is type-checked and imports it. */
export function translationOf(file: string, language: string): string
export function translationState(file: string, language: string, root: string): 'missing' | 'current' | 'outdated'
