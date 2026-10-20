import { description, label } from '@a11d/metadata'
import { http, operation, Operation } from '#infrastructure/operations/Operation.js'
import { getReleaseSources } from './changelog.js'

@operation()
@label('List releases')
@description('Answers the changelog of the running build and the release notes it carries.')
@http({ method: 'GET', path: '/meta/releases' })
export class ListReleases extends Operation<object, Awaited<ReturnType<typeof getReleaseSources>>> {
	run() {
		return getReleaseSources()
	}
}
