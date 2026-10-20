import { description, label } from '@a11d/metadata'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { type User } from '../User.js'

@operation()
@label('Read the user')
@description('Answers the signed-in user: name, time zones, settings and default calendar.')
@http({ method: 'GET', path: '/user' })
export class GetUser extends Operation<object, User> {
	run({ user }: OperationContext): Promise<User> {
		return Promise.resolve(user)
	}
}
