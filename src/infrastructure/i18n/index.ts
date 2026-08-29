import { Localizer, LocalizableString, LocalizerController } from '@3mo/localization'
import { PageComponent, DialogComponent } from '@a11d/lit-application'
import en from './en.json' with { type: 'json' }
import de from './de.json' with { type: 'json' }
import fr from './fr.json' with { type: 'json' }
import es from './es.json' with { type: 'json' }
import pt from './pt.json' with { type: 'json' }
import it from './it.json' with { type: 'json' }

// Force eager initialization of global t() helper before module evaluation.
if (typeof globalThis.t !== 'function') {
	throw new Error(`@3mo/localization did not initialize the global t() (${LocalizableString.name})`)
}

/** Localization configuration with source English and translated locale dictionaries. */
Localizer.dictionaries.add({ en, de, fr, es, pt, it })

// Install LocalizerController on PageComponent and DialogComponent bases to ensure live updates without reloads.
for (const base of [PageComponent, DialogComponent]) {
	base.addInitializer(host => new LocalizerController(host as never))
}
