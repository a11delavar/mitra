import { model as baseModel } from '@a11d/api-model-value-constructor'

export function model(name: string) {
	return (target: any) => {
		baseModel(name)(target)

		// Runtime: make @type accessible on any instance
		target.prototype['@type'] = name

		// Serialization: ensure @type is included in JSON.stringify output
		const originalToJSON = target.prototype.toJSON
		target.prototype.toJSON = function () {
			const json = originalToJSON ? originalToJSON.call(this) : { ...this }
			return { '@type': name, ...json }
		}
	}
}
