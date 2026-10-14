import { test, expect } from '@playwright/test';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp } from 'firebase/firestore';

test.beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Browser tests require the local Firestore Emulator.');
  const env = await initializeTestEnvironment({ projectId: 'demo-calendar-checkin', firestore: { host: '127.0.0.1', port: 8080 } });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const [index, name] of ['Bảo Long', 'Anh Nam', 'Lan Anh', 'Khách thử nghiệm'].entries()) {
      await setDoc(doc(db, 'checkins', `fixture-${index}`), {
        date: '2026-10-14', memberId: index < 3 ? `member_0${index + 1}` : null,
        name, type: index < 3 ? 'member' : 'guest', checkedInAt: Timestamp.fromMillis(1791975600000 + index * 1000),
      });
    }
    await setDoc(doc(db, 'checkins', 'other-month'), { date: '2026-11-14', memberId: null, name: 'Khách tháng khác', type: 'guest', checkedInAt: Timestamp.fromMillis(1791975600000) });
  });
  await env.cleanup();
});

test('calendar navigates months, limits avatars and keeps the selected month after quick changes', async ({ page }) => {
  await page.goto('index.html?month=2026-10&emulator=1');
  await expect(page.locator('#month-title')).toHaveText('Tháng 10, 2026');
  const day = page.locator('a[data-date="2026-10-14"]').locator('..');
  await expect(day.locator('img')).toHaveCount(3);
  await expect(day).toContainText('+1');
  await page.getByRole('button', { name: 'Tháng sau', exact: true }).click();
  await expect(page.locator('#month-title')).toHaveText('Tháng 11, 2026');
  await expect(page.locator('a[data-date="2026-11-14"]').locator('..').locator('img')).toHaveCount(1);
  await page.getByRole('button', { name: 'Tháng trước', exact: true }).click();
  await page.getByRole('button', { name: 'Tháng trước', exact: true }).click();
  await expect(page.locator('#month-title')).toHaveText('Tháng 9, 2026');
  await expect(page.locator('.calendar-grid img')).toHaveCount(0);
});

test('calendar fits a narrow phone and opens the chosen date', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('index.html?month=2026-10&emulator=1');
  await expect(page.locator('a[data-date="2026-10-14"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('a[data-date="2026-10-14"]').click();
  await expect(page).toHaveURL(/detail\.html\?date=2026-10-14&emulator=1$/);
});

test('member selection never writes, explicit check-in syncs to a second tab, guests persist after reload', async ({ page, context }) => {
  await page.goto('detail.html?date=2026-10-15&emulator=1');
  await expect(page.locator('.member-card')).toHaveCount(5);
  await expect(page.locator('#data-status')).toContainText('Đã đồng bộ');
  const second = await context.newPage();
  await second.goto('detail.html?date=2026-10-15&emulator=1');
  await expect(second.locator('#data-status')).toContainText('Đã đồng bộ');
  await page.locator('[data-member-id="member_01"] .member-select').click();
  await expect(page.locator('[data-member-id="member_01"] .member-action')).toBeVisible();
  await expect(page.locator('#attendee-count')).toHaveText('0');
  await page.locator('[data-member-id="member_01"] .checkin-button').click();
  await expect(page.locator('#attendee-count')).toHaveText('1');
  await expect(second.locator('#attendee-count')).toHaveText('1');
  await expect(second.locator('[data-member-id="member_01"]')).toHaveClass(/is-checked/);
  await page.getByRole('button', { name: 'Bạn là khách vãng lai' }).click();
  await page.getByLabel('Họ và tên').fill('<script>');
  await page.getByRole('button', { name: 'Xác nhận check-in' }).click();
  await expect(page.locator('#guest-error')).not.toBeEmpty();
  await expect(page.locator('#attendee-count')).toHaveText('1');
  await page.getByLabel('Họ và tên').fill('  Nguyễn   Khách  ');
  await page.getByRole('button', { name: 'Xác nhận check-in' }).click();
  await expect(page.locator('#attendee-count')).toHaveText('2');
  await expect(page.getByLabel('Họ và tên')).toHaveValue('');
  await page.reload();
  await expect(page.locator('#attendee-count')).toHaveText('2');
  await expect(page.locator('#attendee-list')).toContainText('Nguyễn Khách');
  await page.locator('#back-link').click();
  await expect(page).toHaveURL(/month=2026-10&emulator=1/);
  await second.close();
});

test('invalid dates block check-in and Firebase CDN failure is explained', async ({ page }) => {
  await page.goto('detail.html?date=2026-02-29&emulator=1');
  await expect(page.locator('#invalid-date')).toBeVisible();
  await expect(page.locator('#detail-content')).toBeHidden();
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort());
  await page.goto('index.html?month=2026-10&emulator=1');
  await expect(page.locator('#data-status')).toContainText('Không tải được Firebase');
  await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible();
});

test('offline guest submission waits for the server and reconnects with one document', async ({ page, context }) => {
  await page.goto('detail.html?date=2026-10-16&emulator=1');
  await expect(page.locator('#data-status')).toContainText('Đã đồng bộ');
  await page.getByRole('button', { name: 'Bạn là khách vãng lai' }).click();
  await page.getByLabel('Họ và tên').fill('Khách Offline');
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Xác nhận check-in' }).click();
  await expect(page.locator('#guest-submit')).toBeDisabled();
  await expect(page.locator('#attendee-count')).toHaveText('0');
  await expect(page.locator('#notice')).toContainText('chờ');
  await context.setOffline(false);
  await expect(page.locator('#attendee-count')).toHaveText('1');
  await expect(page.locator('#guest-submit')).toBeEnabled();
  await page.reload();
  await expect(page.locator('#attendee-count')).toHaveText('1');
});

test('concurrent service calls confirm one creation and report the other as already checked in', async ({ page, context }) => {
  await page.goto('detail.html?date=2026-10-17&emulator=1');
  await expect(page.locator('#data-status')).toContainText('Đã đồng bộ');
  const second = await context.newPage();
  await second.goto('detail.html?date=2026-10-17&emulator=1');
  await expect(second.locator('#data-status')).toContainText('Đã đồng bộ');
  const write = tab => tab.evaluate(async () => (await import('./js/checkin-service.js')).checkInMember('2026-10-17', 'member_04'));
  const results = await Promise.all([write(page), write(second)]);
  expect(results.map(result => result.alreadyExists).sort()).toEqual([false, true]);
  await expect(page.locator('#attendee-count')).toHaveText('1');
  await second.close();
});

test('phone layout, keyboard selection and history navigation keep the daily list live', async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('index.html?month=2026-10&emulator=1');
  await page.locator('a[data-date="2026-10-18"]').click();
  await expect(page.locator('#data-status')).toContainText('Đã đồng bộ');
  const select = page.locator('[data-member-id="member_02"] .member-select');
  await select.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('[data-member-id="member_02"] .member-action')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('#member-grid').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length)).toBe(2);
  await page.goBack();
  await expect(page.locator('#month-title')).toHaveText('Tháng 10, 2026');
  await page.goForward();
  await expect(page.locator('#data-status')).toContainText('Đã đồng bộ');
  const second = await context.newPage();
  await second.goto('detail.html?date=2026-10-18&emulator=1');
  await expect(second.locator('#data-status')).toContainText('Đã đồng bộ');
  await second.evaluate(async () => (await import('./js/checkin-service.js')).checkInGuest('2026-10-18', 'Khách Lịch Sử'));
  await expect(page.locator('#attendee-list')).toContainText('Khách Lịch Sử');
  await page.screenshot({ path: '.playwright/detail-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('index.html?month=2026-10&emulator=1');
  await expect(page.locator('a[data-date="2026-10-14"]').locator('..').locator('img')).toHaveCount(3);
  await page.screenshot({ path: '.playwright/calendar-desktop.png', fullPage: true });
  await second.close();
});

test('every local calendar link preserves emulator isolation including invalid date recovery', async ({ page }) => {
  const productionRequests = [];
  await page.route(/https:\/\/firestore\.googleapis\.com\/.*/, route => {
    productionRequests.push(route.request().url()); return route.abort();
  });
  for (const [source, selector] of [
    ['index.html?month=2026-10&emulator=1', '.brand'],
    ['detail.html?date=2026-10-14&emulator=1', '.brand'],
    ['detail.html?date=2026-02-29&emulator=1', '#back-link'],
    ['detail.html?date=2026-02-29&emulator=1', '#invalid-date a'],
  ]) {
    await page.goto(source);
    await page.locator(selector).click();
    await expect(page).toHaveURL(/[?&]emulator=1(?:&|$)/);
    await expect(page.locator('#data-status')).toContainText('Đã đồng bộ');
  }
  expect(productionRequests).toEqual([]);
});

test('missing create permission is reported as failure rather than duplicate success', async ({ page }) => {
  const env = await initializeTestEnvironment({ projectId: 'demo-calendar-checkin', firestore: {
    host: '127.0.0.1', port: 8080,
    rules: 'rules_version = "2"; service cloud.firestore { match /databases/{database}/documents { match /checkins/{id} { allow read: if true; allow write: if false; } } }',
  } });
  try {
    await page.goto('detail.html?date=2026-10-19&emulator=1');
    await expect(page.locator('#data-status')).toContainText('Đã đồng bộ');
    await page.locator('[data-member-id="member_05"] .member-select').click();
    await page.locator('[data-member-id="member_05"] .checkin-button').click();
    await expect(page.locator('#notice')).toContainText('Firestore Rules');
    await expect(page.locator('#notice')).toHaveClass(/is-error/);
    await expect(page.locator('#attendee-count')).toHaveText('0');
  } finally {
    const { readFile } = await import('node:fs/promises');
    await initializeTestEnvironment({ projectId: 'demo-calendar-checkin', firestore: { host: '127.0.0.1', port: 8080, rules: await readFile('firestore.rules', 'utf8') } }).then(restore => restore.cleanup());
    await env.cleanup();
  }
});
