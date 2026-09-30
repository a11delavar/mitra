import { LocalizableString, LocalizerController } from '@3mo/localization'
import { PageComponent, DialogComponent } from '@a11d/lit-application'
import './dictionaries.js'

// Force eager initialization of global t() helper before module evaluation.
if (typeof globalThis.t !== 'function') {
	throw new Error(`@3mo/localization did not initialize the global t() (${LocalizableString.name})`)
}

// Install LocalizerController on PageComponent and DialogComponent bases to ensure live updates without reloads.
for (const base of [PageComponent, DialogComponent]) {
	base.addInitializer(host => new LocalizerController(host as never))
}
