import { Localizer } from '@3mo/localization'
import { getIntegrations, reimportIntegration, updateIntegration } from '../../../infrastructure/http/Api.js'

// The sample calendar is written in one language (see Demo.ts). A switch sends the new one and asks for a re-import,
// which rebuilds the entries the way the day change does; the sources event then refreshes the sidebar.
Localizer.languages.change.subscribe(async language => {
	for (const demo of getIntegrations().filter(integration => integration.type === 'demo')) {
		try {
			await updateIntegration({ ...demo, credentials: { ...demo.credentials, language } } as typeof demo)
			await reimportIntegration(demo.id)
		} catch {
			// The next day's rebuild, or a re-import by hand, catches up.
		}
	}
})
