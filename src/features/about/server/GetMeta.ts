import { description, label } from '@a11d/metadata'
import { FileLimits } from '#features/files/server/FileLimits.js'
import { InstanceSettings } from '#features/settings/InstanceSettings.js'
import { State } from '#infrastructure/database/State.js'
import { environment } from '#infrastructure/server/Environment.js'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { Instance } from '../Instance.js'
import { updateChecker } from './updates.js'
import { runningReleaseUrl } from './changelog.js'

@operation()
@label('Read the instance')
@description('Answers what this instance is: its name, version, mode, whether people sign in and agents may connect, file limits, an update when one is out, and what its administrators set for everyone.')
@http({ method: 'GET', path: '/meta' })
export class GetMeta extends Operation<object, Instance> {
	async run({ em }: OperationContext) {
		// Only an operator's name travels: without one the browser names the instance itself, in the viewer's language.
		return new Instance({
			name: environment.name,
			version: mitra.version,
			commit: mitra.commit,
			node: process.version,
			development: environment.developer,
			demo: environment.demo,
			files: FileLimits.of(environment),
			signIn: environment.signedIn,
			mcp: environment.mcp,
			releaseUrl: runningReleaseUrl(),
			update: updateChecker.update,
			settings: await State.read<InstanceSettings>(em, InstanceSettings.key),
		})
	}
}
