import { html, type HTMLTemplateResult } from '@a11d/lit'
import { Localizer } from '@3mo/localization'
import { termsMatch } from '../../commands/termsMatch.js'
import { getSettings, setSettings } from '../../../infrastructure/http/Api.js'
import { type UserSettings } from '../UserSettings.js'
import { SettingsStore } from './SettingsStore.js'

/** The dialog's pages, in the order its side panel lists them. */
export const settingsPages = ['general', 'calendar', 'entries', 'notifications', 'administration'] as const

export type SettingsPageId = typeof settingsPages[number]

/** A page's title and icon facts. */
export function settingsPage(id: SettingsPageId): { title: string, icon: string } {
	switch (id) {
		case 'general': return { title: t('General'), icon: 'settings-2' }
		case 'calendar': return { title: t('Calendar'), icon: 'calendar-days' }
		case 'entries': return { title: t('Entries'), icon: 'plus' }
		case 'notifications': return { title: t('Notifications'), icon: 'bell' }
		case 'administration': return { title: t('Administration'), icon: 'shield' }
	}
}

/** Persistence abstraction for setting values (`undefined` represents unchosen default). */
export interface SettingStorage<T> {
	read(): T | undefined
	write(value: T | undefined): Promise<void> | void
}

/** Per-user server storage in `User.settings` JSON column. */
export function userStorage<K extends keyof UserSettings>(key: K): SettingStorage<Exclude<UserSettings[K], undefined>> {
	return {
		read: () => getSettings()[key] as Exclude<UserSettings[K], undefined> | undefined,
		async write(value) {
			const settings = { ...getSettings() }
			if (value === undefined) {
				delete settings[key]
			} else {
				settings[key] = value
			}
			await setSettings(settings)
		},
	}
}

/** Per-device local storage under `Mitra.<Area>.<Thing>` key. */
export function deviceStorage<T>(key: string): SettingStorage<T> {
	return {
		read() {
			const stored = localStorage.getItem(key)
			try {
				return stored === null ? undefined : JSON.parse(stored) as T
			} catch {
				return undefined
			}
		},
		write(value) {
			if (value === undefined) {
				localStorage.removeItem(key)
			} else {
				localStorage.setItem(key, JSON.stringify(value))
			}
		},
	}
}

/** Action contributed by a setting to the command palette. */
export interface SettingVerb {
	heading: string
	apply(): unknown
}

type SettingConstructor = new () => Setting<unknown>

const registeredSettings = new Array<SettingConstructor>()

/** Registers a {@link Setting} class in page display order. */
export const setting = () => (constructor: SettingConstructor) => { registeredSettings.push(constructor) }

let instances: Array<Setting<unknown>> | undefined

// Rebuild cached instances when language changes.
Localizer.languages.change.subscribe(() => instances = undefined)

/** Every setting this build offers, as live instances. */
export function settings(): ReadonlyArray<Setting<unknown>> {
	return instances ??= registeredSettings.map(constructor => new constructor())
}

/**
 * Base class for customizable preferences.
 * Facts are declared as readonly fields (rebuilt on language change); live state uses getters.
 * Only deviations from `fallback` are persisted.
 */
export abstract class Setting<T> {
	/** The row's label, and the first thing its search matches. */
	abstract readonly heading: string

	/** Its lucide glyph, in the row's leading gutter. */
	abstract readonly icon: string

	/** Extra search terms (`<Class>.Keywords` blob). */
	abstract readonly keywords?: string

	/** Which page of the dialog renders it. */
	abstract readonly page: SettingsPageId

	/** The value in force when the user has never chosen — the code's own default, never stored. */
	abstract readonly fallback: T

	protected abstract readonly storage: SettingStorage<T>

	/** Muted secondary description below label. */
	get hint(): string | undefined { return undefined }

	/** What is in force right now. `undefined` from storage delegates to fallback. */
	get value(): T {
		const stored = this.storage.read()
		return stored === undefined ? this.fallback : stored
	}

	/** Whether the user has explicitly chosen a value here. */
	get chosen() {
		return this.storage.read() !== undefined
	}

	/** Whether this setting is available on the current device/browser. */
	get applies() { return true }

	/** Matches query against heading, hint, keywords, and page title using termsMatch. */
	matches(query: string) {
		return termsMatch(query, `${settingsPage(this.page).title} ${this.heading} ${this.hint ?? ''} ${this.keywords ?? ''}`)
	}

	async set(value: T) {
		try {
			await this.storage.write(Object.is(value, this.fallback) ? undefined : value)
		} catch (error) {
			console.error(`Saving the "${this.heading}" setting failed:`, error)
		}
		SettingsStore.notify()
	}

	/** Verbs contributed by this setting to the command palette. */
	get verbs(): Array<SettingVerb> { return [] }

	/** The control the row's trailing cell renders. */
	abstract get control(): HTMLTemplateResult

	/** Optional full-width content rendered beneath the setting row. */
	get details(): HTMLTemplateResult | undefined { return undefined }

	/** Synchronizes rendered control state post-render (see ChoiceSetting.syncControl). */
	syncControl(_row: HTMLElement): void { }

	/** Row leading icon or custom graphic. */
	get glyph(): unknown {
		return html`<mitra-icon icon=${this.icon}></mitra-icon>`
	}
}

/** Boolean setting rendering a switch toggle. */
export abstract class ToggleSetting extends Setting<boolean> {
	override get verbs() {
		return [{
			heading: `${this.heading}: ${this.value ? t('Toggle.Off') : t('Toggle.On')}`,
			apply: () => this.set(!this.value),
		}]
	}

	override get control() {
		return html`
			<button class="switch" role="switch" aria-checked=${this.value ? 'true' : 'false'} aria-label=${this.heading}
				@click=${() => void this.set(!this.value)}
			></button>
		`
	}
}

/** Multi-option setting rendering a select element. */
export abstract class ChoiceSetting<T> extends Setting<T> {
	/** Values and labels on offer in picker display order. */
	abstract get options(): Array<{ value: T, label: string }>

	override get verbs() {
		return this.options
			.filter(option => !Object.is(option.value, this.value))
			.map(option => ({ heading: `${this.heading}: ${option.label}`, apply: () => this.set(option.value) }))
	}

	override get control() {
		const options = this.options
		return html`
			<select aria-label=${this.heading} @change=${(e: Event) => void this.set(options[Number((e.target as HTMLSelectElement).value)]!.value)}>
				<button>
					<selectedcontent></selectedcontent>
				</button>
				${options.map((option, index) => html`
					<option value=${index}>${option.label}</option>
				`)}
			</select>
		`
	}

	/** Synchronizes select element's selectedIndex after rendering. */
	override syncControl(row: HTMLElement) {
		const select = row.querySelector('select')
		const index = this.options.findIndex(option => Object.is(option.value, this.value))
		if (select && index >= 0 && select.selectedIndex !== index) {
			select.selectedIndex = index
		}
	}
}
