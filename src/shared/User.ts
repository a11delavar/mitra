import { model } from './model.js'
import { entity, primaryKey, property, manyToOne } from './orm.js'
import { Source } from './Source.js'

@model('User')
@entity()
export class User {
	static readonly default = new User({ username: '[default_local_user]' })

	@primaryKey() id: string = crypto.randomUUID()
	@property({ type: 'string', unique: true }) username!: string

	@manyToOne(() => Source, { mapToPk: true, deleteRule: 'set null', nullable: true }) defaultSourceId?: string

	constructor(init?: Partial<User>) {
		Object.assign(this, init)
	}
}
