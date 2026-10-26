import { description, label } from '@a11d/metadata'
import { converter } from '@a11d/converter'
import { DateTimeRange } from '@3mo/date-time'
import { z } from 'zod'
import { validation } from '#infrastructure/validation'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { Entry } from '../Entry.js'

class Parameters {
	@validation(z.date())
	@converter({ schema: z.iso.datetime({ offset: true }), construct: (value: string) => new Date(value) })
	readonly start!: Date

	@validation(z.date())
	@converter({ schema: z.iso.datetime({ offset: true }), construct: (value: string) => new Date(value) })
	readonly end!: Date
}

@operation(Parameters)
@label('List entries')
@description('Lists the entries of a window in the visible calendars: the one-off ones in it, the undated ones and the open tasks left behind before it, and every recurring entry once, its overrides with it.')
@http({ method: 'GET', path: '/entries' })
export class ListEntries extends Operation<Parameters, Array<Entry>> {
	run({ em, user }: OperationContext) {
		// The browser expands the recurring entries itself, each once whatever the window.
		return user.filterEntries(em, { range: new DateTimeRange(this.parameters.start, this.parameters.end), sources: { enabled: true, hidden: false } })
	}
}
