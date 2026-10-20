import { description, label } from '@a11d/metadata'
import { FileLimits } from '#features/files/server/FileLimits.js'
import { isDemo, isDeveloperSystem, isMcpEnabled, isSignedIn } from '#infrastructure/environment.js'
import { http, operation, Operation } from '#infrastructure/operations/Operation.js'
import { updateChecker } from './updates.js'
import { runningReleaseUrl } from './changelog.js'

// Only an operator's name travels: without one the client names itself, in the viewer's language.
const instanceName = process.env.MITRA_NAME

@operation()
@label('Read the instance')
@description('Answers what this instance is: its name, version, mode, whether people sign in and agents may connect, file limits, and an update when one is out.')
@http({ method: 'GET', path: '/meta' })
export class GetMeta extends Operation<object, object> {
	run() {
		return Promise.resolve({
			...(instanceName ? { name: instanceName } : {}),
			version: mitra.version,
			commit: mitra.commit,
			node: process.version,
			...(isDeveloperSystem ? { development: true } : {}),
			...(isDemo ? { demo: true } : {}),
			files: FileLimits.fromEnv(),
			signIn: isSignedIn,
			mcp: isMcpEnabled,
			...(runningReleaseUrl() ? { releaseUrl: runningReleaseUrl() } : {}),
			...(updateChecker.update ? { update: updateChecker.update } : {}),
		})
	}
}
