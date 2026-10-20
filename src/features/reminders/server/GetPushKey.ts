import { description, label } from '@a11d/metadata'
import { http, operation, Operation } from '#infrastructure/operations/Operation.js'
import { vapidPublicKey } from './push.js'

@operation()
@label('Read the push key')
@description('Answers the public key a browser subscribes to this instance\'s push notifications with.')
@http({ method: 'GET', path: '/push/key' })
export class GetPushKey extends Operation<object, { readonly key: string }> {
	run() {
		return Promise.resolve({ key: vapidPublicKey })
	}
}
