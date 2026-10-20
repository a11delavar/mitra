import { description, label } from '@a11d/metadata'
import { http, operation, Operation } from '#infrastructure/operations/Operation.js'
import { googleOAuth } from './googleConnect.js'

@operation()
@label('Read the Google setup')
@description('Answers whether this instance is set up to connect Google Calendar.')
@http({ method: 'GET', path: '/integrations/google' })
export class GetGoogleSetup extends Operation<object, { readonly configured: boolean }> {
	run() {
		return Promise.resolve({ configured: !!googleOAuth })
	}
}
