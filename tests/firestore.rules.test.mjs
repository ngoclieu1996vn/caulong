import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';

let env;
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-calendar-checkin', firestore: {
    host: '127.0.0.1', port: 8080, rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
  } });
});
beforeEach(() => env.clearFirestore());
after(() => env?.cleanup());
const database = () => env.unauthenticatedContext().firestore();
const member = (overrides = {}) => ({ date: '2026-10-14', memberId: 'member_01', name: 'Bảo Long', type: 'member', checkedInAt: serverTimestamp(), ...overrides });
const guest = (overrides = {}) => ({ date: '2026-10-14', memberId: null, name: 'Nguyễn Văn A', type: 'guest', checkedInAt: serverTimestamp(), ...overrides });

test('anonymous users can create and read a valid member check-in', async () => {
  const ref = doc(database(), 'checkins/2026-10-14_member_01');
  await assertSucceeds(setDoc(ref, member()));
  const result = await assertSucceeds(getDoc(ref));
  assert.ok(result.data().checkedInAt instanceof Timestamp);
});
test('valid Vietnamese, decomposed Unicode and punctuated guest names are accepted', async () => {
  for (const [i, name] of ['Nguyễn Văn A', 'Bảo Long'.normalize('NFD'), "Anne-Marie O'Neil", 'A'.repeat(60)].entries()) {
    await assertSucceeds(setDoc(doc(database(), `checkins/guest${i}`), guest({ name })));
  }
});
test('member payload cannot use another ID, another name or wrong document ID', async () => {
  for (const payload of [member({ memberId: 'member_06' }), member({ name: 'Giả tên' }), member({ memberId: null }), member({ type: 'admin' })]) {
    await assertFails(setDoc(doc(database(), 'checkins/2026-10-14_member_01'), payload));
  }
  await assertFails(setDoc(doc(database(), 'checkins/wrong-id'), member()));
});
test('strict schema rejects extra and missing fields and invalid dates or timestamps', async () => {
  const missingName = guest(); delete missingName.name;
  for (const data of [guest({ extra: true }), missingName, guest({ date: '2026-13-01' }), guest({ date: '2026-10-32' }), guest({ date: '0000-01-01' }), guest({ date: 20261014 }), guest({ checkedInAt: Timestamp.fromMillis(0) }), guest({ checkedInAt: null })]) {
    await assertFails(setDoc(doc(database(), 'checkins/guest-test'), data));
  }
});
test('invalid guest names cannot bypass the client validator', async () => {
  for (const name of ['', 'A', '  An', 'An ', 'An  Nam', '---', 'A'.repeat(61), '<script>', 'An\nNam', 'An\u0000Nam', '🙂 An']) {
    await assertFails(setDoc(doc(database(), 'checkins/guest-test'), guest({ name })));
  }
});
test('guests cannot reserve member IDs or claim a memberId', async () => {
  await assertFails(setDoc(doc(database(), 'checkins/2026-10-14_member_01'), guest()));
  await assertFails(setDoc(doc(database(), 'checkins/guest-test'), guest({ memberId: 'member_01' })));
});
test('updates, repeated setDoc and deletes are forbidden', async () => {
  const ref = doc(database(), 'checkins/2026-10-14_member_01');
  await assertSucceeds(setDoc(ref, member()));
  await assertFails(setDoc(ref, member()));
  await assertFails(updateDoc(ref, { name: 'Tên khác' }));
  await assertFails(deleteDoc(ref));
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
