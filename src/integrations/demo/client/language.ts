import { Localizer } from '@3mo/localization'
import { Calendars } from '#features/sources/client/Calendars.js'
import { reimportIntegration, updateIntegration } from '#infrastructure/http/Api.js'

// The sample is written in one language, so a switch sends the new one and re-imports. A region alone changes how
// dates read, not the words, so it rebuilds nothing.
Localizer.locales.change.subscribe(async ({ language }) => {
	for (const demo of Calendars.integrations.filter(integration => integration.type === 'demo')) {
		// The server reads a sample stored without a language as English.
		if (((demo.credentials as { language?: string } | undefined)?.language ?? 'en') === language) {
			continue
		}
		try {
			await updateIntegration({ ...demo, credentials: { ...demo.credentials, language } } as typeof demo)
			await reimportIntegration(demo.id)
		} catch {
			// The next day's rebuild, or a re-import by hand, catches up.
		}
	}
})
