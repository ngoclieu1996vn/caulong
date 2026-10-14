import test from 'node:test';
import assert from 'node:assert/strict';
import { todayKey, isValidDateKey, monthRange, calendarDays, normalizeGuestName, formatCheckinTime } from '../js/utils.js';

test('today follows Vietnam midnight rather than the device timezone', () => {
  assert.equal(todayKey(new Date('2026-10-13T18:00:00Z')), '2026-10-14');
  assert.equal(todayKey(new Date('2026-10-13T16:59:59Z')), '2026-10-13');
});
test('date validation rejects impossible dates and malformed URLs', () => {
  for (const value of ['2026-02-29', '2026-04-31', '2026-1-01', '0000-01-01', '2026-13-01', 'garbage', null]) {
    assert.equal(isValidDateKey(value), false, String(value));
  }
  for (const value of ['2028-02-29', '2026-10-14', '0001-01-01', '9999-12-31']) assert.equal(isValidDateKey(value), true);
});
test('month ranges exclude next month and cross a year correctly', () => {
  assert.deepEqual(monthRange(2026, 12), { start: '2026-12-01', end: '2027-01-01' });
  assert.deepEqual(monthRange(2028, 2), { start: '2028-02-01', end: '2028-03-01' });
  assert.throws(() => monthRange(2026, 13));
});
test('calendar begins on Monday and includes leap day without overflow dates', () => {
  const october = calendarDays(2026, 10);
  assert.deepEqual(october.slice(0, 4), [null, null, null, '2026-10-01']);
  assert.equal(october.filter(Boolean).length, 31);
  assert.equal(october.length % 7, 0);
  assert.ok(calendarDays(2028, 2).includes('2028-02-29'));
  assert.equal(calendarDays(2026, 2).filter(Boolean).length, 28);
});
test('guest names preserve Vietnamese letters and normalize spaces and Unicode', () => {
  assert.equal(normalizeGuestName('  Nguyễn   Văn A  '), 'Nguyễn Văn A');
  assert.equal(normalizeGuestName('Bảo Long'.normalize('NFD')), 'Bảo Long');
  assert.equal(normalizeGuestName("Anne-Marie O'Neil"), "Anne-Marie O'Neil");
});
test('invalid guest names cannot pass through normalization', () => {
  for (const name of ['', ' ', 'A', '---', '<img src=x>', 'An\nNam', 'A\u0000B', 'A'.repeat(61), '🙂 An']) {
    assert.throws(() => normalizeGuestName(name), undefined, JSON.stringify(name));
  }
  assert.equal(normalizeGuestName('A'.repeat(60)).length, 60);
});
test('check-in time is always displayed in Vietnam timezone', () => {
  assert.equal(formatCheckinTime({ toDate: () => new Date('2026-10-14T12:05:00Z') }), '19:05');
});
