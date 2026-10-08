/** What site.mjs exports, for the release scripts, which are type-checked and import it. */
export const site: string
export const base: string
export function withBase(path: string): string
export const languages: Array<string>
export function localized(path: string, language: string): string
export function languageOf(path: string): { language: string, path: string }
export const docsBase: string
export const repository: string
export const demo: string
