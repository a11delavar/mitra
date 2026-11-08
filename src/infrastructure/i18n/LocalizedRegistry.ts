import { Localizer } from '@3mo/localization'

/**
 * Classes registered in the order their modules run, which is the order they are listed in, and one live instance of each,
 * rebuilt when the language changes, as their facts are words.
 */
export class LocalizedRegistry<T> {
	private readonly constructors = new Array<new () => T>()
	private instances?: ReadonlyArray<T>

	constructor() {
		Localizer.locales.change.subscribe(() => this.instances = undefined)
	}

	add(constructor: new () => T) {
		this.constructors.push(constructor)
	}

	get classes(): ReadonlyArray<new () => T> {
		return this.constructors
	}

	get all() {
		return this.instances ??= this.constructors.map(constructor => new constructor())
	}
}
