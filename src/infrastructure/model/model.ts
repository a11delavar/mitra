import { ModelValueConstructor, model as baseModel } from '@a11d/api-model-value-constructor'

const valueConstructor = new ModelValueConstructor

/**
 * Decorator registering domain model with `@a11d/api-model-value-constructor` serialization.
 */
export function model(name: string) {
	return (target: any) => {
		baseModel(name)(target)
		target.prototype.toJSON = function (this: object) {
			return valueConstructor.deconstruct(this)
		}
	}
}
