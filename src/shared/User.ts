import { model } from './model.js'
import { entity, primaryKey, property, manyToOne } from './orm.js'
import { Source } from './Source.js'

/** An ADDITIONAL time zone shown in the day grid's time axis: the IANA id plus an optional short
 * custom label ("DE"). The system time zone is not on this list — it anchors the grid itself and is
 * always the column adjacent to the days. */
export interface UserTimeZone {
	id: string
	label?: string
}

@model('User')
@entity()
export class User {
	static readonly default = new User({ username: '[default_local_user]' })

	@primaryKey() id: string = crypto.randomUUID()
	@property({ type: 'string', unique: true }) username!: string

	@manyToOne(() => Source, { mapToPk: true, deleteRule: 'set null', nullable: true }) defaultSourceId?: string

	@property({ type: 'json', nullable: true }) timeZones?: Array<UserTimeZone>

	constructor(init?: Partial<User>) {
		Object.assign(this, init)
	}
}
