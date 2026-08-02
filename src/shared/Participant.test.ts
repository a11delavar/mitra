import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Participants, ParticipantRole, ParticipantStatus } from './Participant.js'

describe('Participants', () => {
	describe('normalize', () => {
		it('is null for none — the tri-state clear, like reminders', () => {
			assert.equal(Participants.normalize(undefined), null)
			assert.equal(Participants.normalize(null), null)
			assert.equal(Participants.normalize([]), null)
			assert.equal(Participants.normalize([{ email: 'not-an-email' }]), null)
		})

		it('lowercases and trims e-mails and drops invalid ones', () => {
			assert.deepEqual([...Participants.normalize([{ email: ' Mixed.Case@Example.com ' }, { email: 'junk' }])!], [
				{ email: 'mixed.case@example.com', role: ParticipantRole.Required, status: ParticipantStatus.NeedsAction },
			])
		})

		it('makes the RFC defaults explicit, so structural comparison never sees a phantom diff', () => {
			const [participant] = Participants.normalize([{ email: 'a@example.com', role: 'nonsense' as ParticipantRole, status: 'nonsense' as ParticipantStatus }])!
			assert.equal(participant!.role, ParticipantRole.Required)
			assert.equal(participant!.status, ParticipantStatus.NeedsAction)
		})

		it('deduplicates by e-mail, merging the flags and letting the later reply win', () => {
			assert.deepEqual([...Participants.normalize([
				{ email: 'a@example.com', organizer: true, name: 'A', status: ParticipantStatus.Accepted },
				{ email: 'A@example.com', status: ParticipantStatus.Tentative },
			])!], [
				{ email: 'a@example.com', name: 'A', organizer: true, role: ParticipantRole.Required, status: ParticipantStatus.Tentative },
			])
		})

		it('keeps at most one organizer — the first', () => {
			const participants = Participants.normalize([
				{ email: 'a@example.com', organizer: true },
				{ email: 'b@example.com', organizer: true },
			])!
			assert.deepEqual(participants.map(participant => !!participant.organizer), [true, false])
		})

		it('caps a runaway list', () => {
			const raw = Array.from({ length: Participants.maxCount + 10 }, (_, index) => ({ email: `p${index}@example.com` }))
			assert.equal(Participants.normalize(raw)!.length, Participants.maxCount)
		})

		it('serializes as a plain JSON array — the column and the wire never see the class', () => {
			assert.equal(JSON.stringify(Participants.normalize([{ email: 'a@example.com' }])), JSON.stringify([{ email: 'a@example.com', role: 'required', status: 'needs-action' }]))
		})
	})

	const replied = () => Participants.normalize([
		{ email: 'organizer@example.com', organizer: true, self: true, status: ParticipantStatus.Accepted },
		{ email: 'attendee-1@example.com', status: ParticipantStatus.Accepted },
		{ email: 'declined@example.com', status: ParticipantStatus.Declined },
		{ email: 'tentative@example.com', status: ParticipantStatus.Tentative },
		{ email: 'pending@example.com', status: ParticipantStatus.NeedsAction },
		{ email: 'delegated@example.com', status: ParticipantStatus.Delegated },
	])!

	describe('counts / summary', () => {
		it('aggregates the replies, counting everything unanswered as awaiting', () => {
			assert.deepEqual(replied().counts, { yes: 2, no: 1, maybe: 1, awaiting: 2 })
		})

		it('reads like "2 yes, 1 no, 1 maybe, 2 awaiting", skipping empty groups', () => {
			assert.equal(replied().summary, '2 yes, 1 no, 1 maybe, 2 awaiting')
			assert.equal(Participants.normalize(replied().slice(0, 2))?.summary, '2 yes')
		})
	})

	describe('emails / mailto', () => {
		const first = (count: number) => Participants.normalize(replied().slice(0, count))!

		it('emails is a paste-ready comma-separated list', () => {
			assert.equal(first(2).emails, 'organizer@example.com, attendee-1@example.com')
		})

		it('mailto addresses everyone but the account itself', () => {
			assert.equal(first(3).mailto, 'mailto:attendee-1@example.com,declined@example.com')
		})

		it('mailto falls back to everyone when the account is the only participant', () => {
			assert.equal(first(1).mailto, 'mailto:organizer@example.com')
		})
	})

	describe('self / others', () => {
		it('splits the account from the people it would notify', () => {
			const participants = replied()
			assert.equal(participants.self?.email, 'organizer@example.com')
			assert.equal(participants.others.length, participants.length - 1)
			assert.equal(participants.others.some(participant => participant.self), false)
		})
	})

	describe('manageable (iTIP RFC 5546)', () => {
		it('is the organizer\'s call — or anyone\'s while there is no organizer yet', () => {
			assert.equal(Participants.normalize([{ email: 'invitee@example.com' }])!.manageable, true)
			assert.equal(Participants.normalize([{ email: 'me@example.com', organizer: true, self: true }])!.manageable, true)
			assert.equal(Participants.normalize([{ email: 'organizer@example.com', organizer: true }])!.manageable, false)
		})
	})

	describe('inviting', () => {
		it('adds pending required invitees and enlists the account as the organizer', () => {
			const invited = new Participants().inviting([' Invitee@Example.com ', 'invitee@example.com', 'junk'], 'me@example.com')!
			assert.deepEqual(invited.map(participant => [participant.email, !!participant.organizer, participant.status]), [
				['me@example.com', true, ParticipantStatus.Accepted],
				['invitee@example.com', false, ParticipantStatus.NeedsAction],
			])
		})

		it('is null when nothing would change, and never displaces an existing organizer', () => {
			const participants = Participants.normalize([{ email: 'organizer@example.com', organizer: true }])!
			assert.equal(participants.inviting(['ORGANIZER@example.com'], 'me@example.com'), null)
			assert.equal(participants.inviting(['second@example.com'])!.organizer?.email, 'organizer@example.com')
		})
	})

	describe('marked', () => {
		it('marks every invitee but never the organizer', () => {
			const participants = Participants.normalize([
				{ email: 'organizer@example.com', organizer: true },
				{ email: 'invitee@example.com' },
			])!
			assert.deepEqual(participants.marked(ParticipantRole.Optional)!.map(participant => participant.role), [ParticipantRole.Required, ParticipantRole.Optional])
		})
	})

	describe('withRole / invitee / without', () => {
		const list = () => Participants.normalize([
			{ email: 'organizer@example.com', organizer: true },
			{ email: 'a@example.com' },
			{ email: 'b@example.com', role: ParticipantRole.Optional },
		])!

		it('marks one invitee and leaves the rest of the list alone', () => {
			assert.deepEqual(list().withRole('A@example.com', ParticipantRole.Optional)!.map(participant => participant.role), [
				ParticipantRole.Required, ParticipantRole.Optional, ParticipantRole.Optional,
			])
		})

		it('is null when the role already holds, the address is unknown, or the target is the organizer', () => {
			assert.equal(list().withRole('b@example.com', ParticipantRole.Optional), null)
			assert.equal(list().withRole('nobody@example.com', ParticipantRole.Optional), null)
			assert.equal(list().withRole('organizer@example.com', ParticipantRole.Optional), null)
		})

		it('exposes only invitees as removable — never the organizer', () => {
			assert.equal(list().invitee('a@example.com')?.email, 'a@example.com')
			assert.equal(list().invitee('organizer@example.com'), undefined)
			assert.equal(list().invitee('nobody@example.com'), undefined)
		})

		it('drops one invitee', () => {
			assert.deepEqual(list().without('a@example.com')!.map(participant => participant.email), ['organizer@example.com', 'b@example.com'])
		})

		it('clears the list once the last invitee goes — a lone organizer has nothing to organize', () => {
			const alone = Participants.normalize([{ email: 'organizer@example.com', organizer: true }, { email: 'a@example.com' }])!
			assert.equal(alone.without('a@example.com'), null)
		})
	})

	describe('organizerFirst / initialOf', () => {
		it('lists the organizer first, everyone else in stored order', () => {
			const participants = Participants.normalize([
				{ email: 'a@example.com' },
				{ email: 'organizer@example.com', organizer: true },
				{ email: 'b@example.com' },
			])!
			assert.deepEqual(participants.organizerFirst.map(participant => participant.email), ['organizer@example.com', 'a@example.com', 'b@example.com'])
		})

		it('initialOf prefers the display name over the e-mail, uppercased', () => {
			assert.equal(Participants.initialOf({ email: 'someone@example.com', name: 'someone' }), 'S')
			assert.equal(Participants.initialOf({ email: 'other@example.com' }), 'O')
		})
	})
})
