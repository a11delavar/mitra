import { ModelValueConstructor, model as baseModel } from '@a11d/api-model-value-constructor'

const valueConstructor = new ModelValueConstructor

/**
 * A shared model: registered with the API's value constructor, which is what tags it with `@type` and
 * revives it into this very class — in the browser through `@a11d/api` itself, on the server through
 * the reviver in `backend/server.ts`.
 *
 * Serializing is that same value constructor, reached through `toJSON` rather than through a replacer,
 * because that slot is contested: MikroORM installs its OWN serializer on every entity prototype that
 * hasn't got one, and `JSON.stringify` calls whatever is there before it consults anything else. Its
 * serializer knows the database's shape, not the API's — it would drop members declared with
 * `@converter` and tag nothing. So a model claims the slot and deconstructs itself into it.
 *
 * That is all this does. What a given model puts on the wire is the model's own business, declared
 * member by member with `@converter` — including what it withholds (`out: {}`).
 */
export function model(name: string) {
	return (target: any) => {
		baseModel(name)(target)
		target.prototype.toJSON = function (this: object) {
			return valueConstructor.deconstruct(this)
		}
	}
}
