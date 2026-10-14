import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildParticipants, rosterFingerprint } from '../js/participants.js';
const records = [0, 1].map(i => ({ id: `guest-${i}`, name: 'An', type: 'guest', memberId: null, checkedInAt: {seconds: 10, nanoseconds: i}, gender: i ? 'Nữ' : 'Nam' }));
test('duplicate_names_remain_distinct', () => {
  const people = buildParticipants(records);
  assert.equal(people.length, 2);
  assert.notEqual(people[0].id, people[1].id);
});
test('recheck_same_id_changes_version', () => {
  assert.notEqual(rosterFingerprint(buildParticipants(records)), rosterFingerprint(buildParticipants(records.map(r => ({...r, checkedInAt: {seconds: 10, nanoseconds: 2}})))));
});
test('order_does_not_change_fingerprint', () => {
  assert.equal(rosterFingerprint(buildParticipants(records)), rosterFingerprint(buildParticipants([...records].reverse())));
});
test('gender_is_optional_in_fingerprint', () => {
  const people = buildParticipants(records), changed = people.map(p => ({...p, gender: 'Nữ'}));
  assert.equal(rosterFingerprint(people), rosterFingerprint(changed));
  assert.notEqual(rosterFingerprint(people, {includeGender:true}), rosterFingerprint(changed, {includeGender:true}));
});
