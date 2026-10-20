import type { Entry } from '#features/entries'

/** Who owns a field: the integration's service, so a re-import brings it back, or Mitra's own database, so deleting the integration loses it. */
export type Owner = 'upstream' | 'mitra'

export type OwnedField = keyof Entry & ('recurrence' | 'reminders' | 'location' | 'description' | 'percentComplete' | 'due' | 'estimate'
	| 'timeZone' | 'participants' | 'attachments' | 'transparency' | 'visibility' | 'relations' | 'allDay' | 'rank')

/** Which fields of its entries an integration holds, and who owns each: a field nobody owns is one its calendars don't hold. */
export class IntegrationOwnership {
	private readonly owners: ReadonlyMap<OwnedField, Owner>

	constructor(owners: Partial<Record<OwnedField, Owner>> = {}) {
		this.owners = new Map(Object.entries(owners) as Array<[OwnedField, Owner]>)
	}

	/** Whether its calendars hold `field`: one they don't, Mitra hides and refuses. */
	holds(field: OwnedField) {
		return this.owners.has(field)
	}

	ownerOf(field: OwnedField): Owner | undefined {
		return this.owners.get(field)
	}

	/** The fields `owner` owns: those Mitra owns are lost with the integration. */
	ownedBy(owner: Owner): ReadonlyArray<OwnedField> {
		return [...this.owners].filter(([, each]) => each === owner).map(([field]) => field)
	}

	without(...dropped: ReadonlyArray<OwnedField>) {
		return new IntegrationOwnership(Object.fromEntries([...this.owners].filter(([field]) => !dropped.includes(field))))
	}
}
