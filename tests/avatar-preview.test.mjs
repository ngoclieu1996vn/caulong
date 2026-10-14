import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

// Optional override lets local tooling run this without installing app dependencies.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
let browser;
let server;
before(async () => {
  try { await fetch(base, { signal: AbortSignal.timeout(1000) }); }
  catch {
    server = spawn(process.execPath, ['tests/serve.mjs'], { stdio: 'ignore', windowsHide: true });
    let listening = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      try { await fetch(base, { signal: AbortSignal.timeout(500) }); listening = true; break; }
      catch { await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    assert.ok(listening, 'Local static server must start');
  }
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.kill(); });
const base = 'http://127.0.0.1:4173/repository-name/';

async function openPage(path, mobile = false) {
  const page = await browser.newPage({ viewport: mobile ? { width: 320, height: 700 } : { width: 1100, height: 850 }, hasTouch: mobile, isMobile: mobile });
  page.setDefaultTimeout(5000);
  // Keep all Firebase boundaries local, including the optional daily panels.
  await page.route('**/js/billing-service.js', route=>route.fulfill({contentType:'text/javascript',body:`export const watchBilling=(date,cb)=>{queueMicrotask(()=>cb({data:null,fromCache:false}));return ()=>{};};`}));
  await page.route('**/js/team-games-service.js', route=>route.fulfill({contentType:'text/javascript',body:`export const watchTeamGame=(date,cb)=>{queueMicrotask(()=>cb({data:null,fromCache:false}));return ()=>{};};`}));
  // Replace only the external data boundary; render the real application and avatars.
  await page.route('**/js/checkin-service.js', route => route.fulfill({
    contentType: 'text/javascript',
    body: `import { MEMBERS } from './members.js';
      window.testWrites = 0;
      export function watchCheckins(filter, onData) {
        const data = {fromCache:false,hasPendingWrites:false,records:[
          {id:'member',date:'2026-10-14',memberId:MEMBERS[1].id,name:MEMBERS[1].name,type:'member',checkedInAt:{toMillis:()=>1,toDate:()=>new Date('2026-10-14T12:00:00Z')}},
          {id:'guest',date:'2026-10-14',memberId:null,name:'Khách thử',type:'guest',checkedInAt:{toMillis:()=>2,toDate:()=>new Date('2026-10-14T12:01:00Z')}}
        ]}; window.testRefresh = () => onData(data);
        queueMicrotask(window.testRefresh); return () => {};
      }
      export async function checkInMember() { window.testWrites++; return {alreadyExists:false}; }
      export async function checkInGuest() { window.testWrites++; }
      export const checkinErrorMessage = () => 'Lỗi kiểm thử';`,
  }));
  await page.goto(base + path);
  await page.waitForFunction(() => document.querySelector('#data-status').textContent.includes('Đã đồng bộ'));
  return page;
}

test('member avatar opens a named preview without selecting or writing; Escape restores focus', async () => {
  const page = await openPage('detail.html?date=2026-10-14');
  try {
    const card = page.locator('[data-member-id="member_01"]');
    const name = await card.locator('.member-name').textContent();
    const avatar = card.getByRole('button', { name: `Xem ảnh của ${name}`, exact: true });
    await avatar.click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });
    assert.equal(await dialog.locator('figcaption').textContent(), name);
    assert.equal(await dialog.locator('img').getAttribute('src'), await avatar.locator('img').getAttribute('src'));
    assert.equal(await card.locator('.member-action').isVisible(), false);
    assert.equal(await page.evaluate(() => window.testWrites), 0);
    await page.keyboard.press('Escape');
    assert.equal(await dialog.isVisible(), false);
    assert.equal(await avatar.evaluate(node => node === document.activeElement), true);
    await card.locator('.member-select').click();
    assert.equal(await card.locator('.member-action').isVisible(), true);
    await card.locator('.checkin-button').click();
    assert.equal(await page.evaluate(() => window.testWrites), 1);
  } finally { await page.close(); }
});

test('calendar avatar opens the photo while clicking the day still navigates', async () => {
  const page = await openPage('index.html?month=2026-10');
  try {
    const day = page.locator('a[data-date="2026-10-14"]');
    const cell = day.locator('..');
    await cell.locator('.avatar-trigger').first().click();
    await page.getByRole('dialog').waitFor({ state: 'visible' });
    assert.ok(page.url().includes('index.html'));
    await page.getByRole('button', { name: 'Đóng ảnh' }).click();
    await day.locator('.day-number').click();
    await page.waitForURL('**/detail.html?date=2026-10-14');
    assert.equal(await page.evaluate(() => window.testWrites), 0);
  } finally { await page.close(); }
});

test('mobile attendee avatar supports touch, fits the viewport and closes from the backdrop', async () => {
  const page = await openPage('detail.html?date=2026-10-14', true);
  try {
    await page.locator('#attendee-list .avatar-trigger').first().tap();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });
    const box = await dialog.boundingBox();
    assert.ok(box.width <= 320 && box.height <= 700);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: '.playwright/avatar-mobile.png' });
    await page.touchscreen.tap(3, 3);
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => window.testWrites), 0);
  } finally { await page.close(); }
});

test('desktop hover enlarges the thumbnail and keyboard opens the viewer', async () => {
  const page = await openPage('detail.html?date=2026-10-14');
  try {
    const avatar = page.locator('#member-grid .avatar-trigger').first();
    await avatar.hover();
    await page.waitForFunction(() => {
      const image = document.querySelector('#member-grid .avatar-trigger img');
      return new DOMMatrixReadOnly(getComputedStyle(image).transform).a > 1;
    });
    await avatar.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('dialog').waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Đóng ảnh' }).click();
    assert.equal(await page.getByRole('dialog').isVisible(), false);
  } finally { await page.close(); }
});

test('closing after a realtime rerender restores focus to the replacement avatar', async () => {
  const page = await openPage('detail.html?date=2026-10-14');
  try {
    const avatar = page.locator('#attendee-list .avatar-trigger').first();
    await avatar.click();
    await page.getByRole('dialog').waitFor({ state: 'visible' });
    await page.evaluate(() => window.testRefresh());
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    // The dialog becomes hidden before its queued close event restores focus.
    await page.waitForFunction(() => document.activeElement === document.querySelector('#attendee-list .avatar-trigger'));
    assert.equal(await avatar.evaluate(node => document.activeElement === node), true);
  } finally { await page.close(); }
});
