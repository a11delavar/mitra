import { model } from './model.js'
import { entity, primaryKey, property } from './orm.js'

@model('User')
@entity()
export class User {
	static readonly default = new User({ username: '[default_local_user]' })

	@primaryKey() id: string = crypto.randomUUID()
	@property({ type: 'string', unique: true }) username!: string

	constructor(init?: Partial<User>) {
		Object.assign(this, init)
	}
}
