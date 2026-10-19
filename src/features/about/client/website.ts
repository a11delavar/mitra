import { Localizer } from '@3mo/localization'
import { docsBase, languages, localized, site, withBase } from '../../../../website/site.mjs'

/** A page of the website, in the app's language where the website has it. */
export const onWebsite = (route: string) => {
	const language = Localizer.locales.current.language
	return new URL(withBase(languages.includes(language) ? localized(route, language) : route), site).href
}

/** A page of the documentation, by its slug (`agents`, `views/week`). */
export const docsPage = (page: string) => onWebsite(`/${docsBase}/${page}`)
