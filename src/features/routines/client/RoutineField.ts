import { Component, component, css, html, property } from '@a11d/lit'
import { ChooseEntryRoutine, CreateRoutine } from '#operations'
import type { Entry } from '#features/entries'
import { EntryStore, reportSaveError } from '#features/entries/client/EntryStore.js'
import { RoutineStore } from './RoutineStore.js'
import './RoutineFlame.js'

/** The option that starts a routine from the entry, apart from every routine's id. */
const NEW = '\u0000new'

/**
 * The editor's Routine row: the routine the entry belongs to, chosen among its calendar's, a new one started from it, or
 * none, which takes it out of every routine for good. How a wrongly gathered entry leaves, and how a missed one joins.
 */
@component('mitra-routine-field')
export class RoutineField extends Component {
	/** Whether the row is worth showing: the entry belongs to a routine, was taken out of them, or repeats. */
	static showsFor(entry: Entry) {
		return entry.persisted && !entry.type.isAvailability && (!!entry.routineId || !!entry.routineDeclined || !!entry.recurrence?.freq || !!entry.recurringEntryId)
	}

	@property({ type: Object }) entry?: Entry

	readonly routines = new RoutineStore(this)

	/** The entry a choice is made for: the recurring entry for one of its occurrences, whose routine they share. */
	private get entryId() {
		return this.entry!.recurringEntryId ?? this.entry!.id!
	}

	/** Its calendar's routines, and the one it belongs to wherever that lives. */
	private get choices() {
		const entry = this.entry!
		return [...RoutineStore.routines.values()].filter(routine => routine.sourceId === entry.sourceId || routine.id === entry.routineId)
	}

	private readonly handleChange = async (e: Event) => {
		const value = (e.target as HTMLElement & { value?: string | null }).value
		const entry = this.entry!
		try {
			const routineId = value === NEW ? (await CreateRoutine.call({ entryId: this.entryId })).id : (await ChooseEntryRoutine.call({ id: this.entryId, routineId: value ?? null })).routineId
			entry.routineId = routineId ?? undefined
			entry.routineDeclined = routineId ? undefined : true
			EntryStore.notify()
		} catch (error) {
			reportSaveError(error)
		}
		await RoutineStore.refresh()
	}

	static override get styles() {
		return css`
			mitra-routine-field {
				display: contents;

				/* The name gives way before the streak does. */
				[slot=value] {
					flex: 1;
					display: flex;
					align-items: center;
					gap: 0.5rem;
					min-inline-size: 0;

					> .label {
						min-inline-size: 0;
						overflow: hidden;
						text-overflow: ellipsis;
					}

					> mitra-routine-flame {
						flex: none;
						margin-inline-start: auto;
					}
				}
			}
		`
	}

	protected override createRenderRoot() { return this }

	protected override get template() {
		const entry = this.entry
		if (!entry) {
			return html.nothing
		}
		const current = this.choices.find(routine => routine.id === entry.routineId)
		// "Not a routine" is ticked only once chosen; a repeating entry no routine has gathered yet has nothing ticked.
		return html`
			<mitra-select label=${t('Routine')} title=${t('Routine')} .placeholder=${!current} .value=${current?.id ?? (entry.routineDeclined ? null : undefined)} @change=${this.handleChange}>
				<span slot="value">
					${!current ? entry.routineDeclined ? t('Not a routine') : t('No routine') : html`
						<span class="label">${current.label}</span>
						<mitra-routine-flame .routine=${current}></mitra-routine-flame>
					`}
				</span>
				<mitra-option .value=${null} marker="circle-off" data-muted>${t('Not a routine')}</mitra-option>
				${!this.choices.length ? html.nothing : html`<hr aria-hidden="true">`}
				${this.choices.map(routine => html`
					<mitra-option .value=${routine.id} label=${routine.label}>
						${routine.label}
						<mitra-routine-flame slot="detail" .routine=${routine}></mitra-routine-flame>
					</mitra-option>
				`)}
				<hr aria-hidden="true">
				<mitra-option .value=${NEW} marker="plus" data-muted>${t('New routine')}</mitra-option>
			</mitra-select>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-routine-field': RoutineField
	}
}
