import { model } from './model.js'
import { entity, primaryKey, property, oneToMany } from './orm.js'
import { Collection } from './orm.js'
import { Integration } from './Integration.js'

@model('User')
@entity()
export class User {
	static readonly default = new User({ username: '[default_local_user]' })

	@primaryKey() id = crypto.randomUUID() as string
	@property({ type: 'string', unique: true }) username!: string
	@oneToMany(() => Integration, integration => integration.user) integrations = new Collection<Integration>(this)

	constructor(init?: Partial<User>) {
		Object.assign(this, init)
	}

	private async getIntegrations() {
		if (!this.integrations.isInitialized()) {
			await this.integrations.init()
		}
		return this.integrations.getItems()
	}

	async getIntegration<T extends Integration>(type: Constructor<T>) {
		const integrations = await this.getIntegrations()
		return integrations.find((i): i is T => i instanceof type)
	}
}
