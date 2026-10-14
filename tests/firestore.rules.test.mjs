import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { MEMBERS } from '../js/members.js';

let env;
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-calendar-checkin', firestore: {
    host: '127.0.0.1', port: 8080, rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
  } });
});
beforeEach(() => env.clearFirestore());
after(() => env?.cleanup());
const database = () => env.unauthenticatedContext().firestore();
const member = (overrides = {}) => ({ date: '2026-10-14', memberId: MEMBERS[0].id, name: MEMBERS[0].name, type: 'member', checkedInAt: serverTimestamp(), ...overrides });
const guest = (overrides = {}) => ({ date: '2026-10-14', memberId: null, name: 'Nguyễn Văn A', type: 'guest', checkedInAt: serverTimestamp(), ...overrides });

test('anonymous users can create and read a valid member check-in', async () => {
  const ref = doc(database(), 'checkins/2026-10-14_member_01');
  await assertSucceeds(setDoc(ref, member()));
  const result = await assertSucceeds(getDoc(ref));
  assert.ok(result.data().checkedInAt instanceof Timestamp);
});

test('every currently configured member can check in with the exact configured name and ID', async () => {
  for (const person of MEMBERS) {
    const ref = doc(database(), `checkins/2026-10-14_${person.id}`);
    await assertSucceeds(setDoc(ref, member({ memberId: person.id, name: person.name })));
    assert.equal((await getDoc(ref)).data().name, person.name);
  }
});

test('member names do not need a matching name map in Firestore Rules', async () => {
  await assertSucceeds(setDoc(doc(database(), 'checkins/2026-10-14_member_01'), member({ name: 'Tên mới tùy ý' })));
});
test('valid Vietnamese, decomposed Unicode and punctuated guest names are accepted', async () => {
  for (const [i, name] of ['Nguyễn Văn A', 'Bảo Long'.normalize('NFD'), "Anne-Marie O'Neil", 'A'.repeat(60)].entries()) {
    await assertSucceeds(setDoc(doc(database(), `checkins/guest${i}`), guest({ name })));
  }
});
test('Rules do not validate member IDs, names, type or document ID format', async () => {
  for (const [index, payload] of [member({ memberId: 'member_07' }), member({ name: 'Tên khác' }), member({ memberId: null }), member({ type: 'custom' })].entries()) {
    await assertSucceeds(setDoc(doc(database(), `checkins/free-member-${index}`), payload));
  }
  await assertSucceeds(setDoc(doc(database(), 'checkins/free-document-id'), member()));
});
test('Rules accept missing or extra fields and do not validate dates or timestamps', async () => {
  const missingName = guest(); delete missingName.name;
  for (const [index, data] of [{}, guest({ extra: true }), missingName, guest({ date: '2026-13-01' }), guest({ date: '2026-10-32' }), guest({ date: '0000-01-01' }), guest({ date: 20261014 }), guest({ checkedInAt: Timestamp.fromMillis(0) }), guest({ checkedInAt: null })].entries()) {
    await assertSucceeds(setDoc(doc(database(), `checkins/free-payload-${index}`), data));
  }
});
test('guest name validation is not enforced by Firestore Rules', async () => {
  for (const [index, name] of ['', 'A', '  An', 'An ', 'An  Nam', '---', 'A'.repeat(61), '<script>', 'An\nNam', 'An\u0000Nam', '🙂 An'].entries()) {
    await assertSucceeds(setDoc(doc(database(), `checkins/free-name-${index}`), guest({ name })));
  }
});
test('Rules do not check guest memberId or document ID', async () => {
  await assertSucceeds(setDoc(doc(database(), 'checkins/2026-10-14_member_01'), guest()));
  await assertSucceeds(setDoc(doc(database(), 'checkins/guest-test'), guest({ memberId: 'member_01' })));
});
test('updates and repeated setDoc remain forbidden', async () => {
  const ref = doc(database(), 'checkins/2026-10-14_member_01');
  await assertSucceeds(setDoc(ref, member()));
  await assertFails(setDoc(ref, member()));
  await assertFails(updateDoc(ref, { name: 'Tên khác' }));
});

test('anonymous users can delete a mistaken check-in and check in again', async () => {
  const ref = doc(database(), 'checkins/2026-10-14_member_01');
  await assertSucceeds(setDoc(ref, member()));
  await assertSucceeds(deleteDoc(ref));
  assert.equal((await getDoc(ref)).exists(), false);
  await assertSucceeds(setDoc(ref, member()));
});
test('concurrent clients cannot create duplicate member check-ins', async () => {
  const outcomes = await Promise.allSettled([database(), database()].map(db => setDoc(doc(db, 'checkins/2026-10-14_member_01'), member())));
  assert.equal(outcomes.filter(value => value.status === 'fulfilled').length, 1);
});
test('other collections cannot be read or written', async () => {
  const ref = doc(database(), 'other/test');
  await assertFails(setDoc(ref, guest()));
  await assertFails(getDoc(ref));
});
