import {test,expect} from '@playwright/test';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,setDoc,Timestamp} from 'firebase/firestore';
import {openBilling} from './billing-helpers.mjs';
let env;
test.beforeAll(async()=>{
  env=await initializeTestEnvironment({projectId:'demo-calendar-checkin',firestore:{host:'127.0.0.1',port:8080}});
  await env.withSecurityRulesDisabled(async c=>{
    for(const date of ['2026-12-25','2026-12-26'])for(const [i,gender] of ['Nam','Nữ'].entries())
      await setDoc(doc(c.firestore(),'checkins',`${date}_${i}`),{date,name:`Bạn ${i}`,type:'guest',memberId:null,gender,checkedInAt:Timestamp.fromMillis(1000+i)});
  });
});
test.afterAll(()=>env?.cleanup());

test('only successful credentials are remembered, including after reload and unavailable storage',async({page})=>{
  await page.goto('detail.html?date=2026-12-27&emulator=1#list');
  await page.locator('#billing-toggle').click();
  await page.getByLabel('Username',{exact:true}).fill('admin');
  await page.getByLabel('Password',{exact:true}).fill('wrong');
  await page.getByLabel('Password',{exact:true}).press('Enter');
  await expect(page.locator('#billing-login-error')).not.toBeEmpty();
  await page.keyboard.press('Escape');await page.locator('#billing-toggle').click();
  await expect(page.getByLabel('Password',{exact:true})).toHaveValue('');
  await page.keyboard.press('Escape');await openBilling(page);
  await page.keyboard.press('Escape');await page.reload();await page.locator('#billing-toggle').click();
  await expect(page.getByLabel('Username',{exact:true})).toHaveValue('admin');
  await expect(page.getByLabel('Password',{exact:true})).toHaveValue('lieuvippro');
  await page.getByLabel('Password',{exact:true}).press('Enter');
  await expect(page.locator('#billing-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.evaluate(()=>{Storage.prototype.getItem=Storage.prototype.setItem=()=>{throw new DOMException('Storage blocked','SecurityError');};});
  await openBilling(page);
  await expect(page.locator('#billing-panel')).toBeVisible();
});

for(const calculate of [false,true])test(`${calculate?'calculate':'save'} waits for confirmation, prevents repeats and closes with a persisted hero summary`,async({page})=>{
  const date=calculate?'2026-12-26':'2026-12-25';
  // Keep real server reads/transactions. Gate only the save boundary to observe pending/error states.
  await page.route(url=>url.pathname.endsWith('/js/billing-service.js')&&!url.search,route=>route.fulfill({contentType:'text/javascript',body:`
    import {watchBilling,saveBilling as save} from './billing-service.js?actual';
    export {watchBilling};
    export async function saveBilling(...args){await new Promise((resolve,reject)=>{window.finishSave=()=>resolve();window.failSave=()=>reject(new Error('Lỗi thử lưu'));});return save(...args);}
  `}));
  await page.goto(`detail.html?date=${date}&emulator=1`);
  await expect(page.locator('#data-status')).toContainText('Đã đồng bộ');await openBilling(page);
  await page.getByLabel('Số lượng cầu 1').fill('3');await page.getByLabel('Số bình trà').fill('2');
  await page.locator('.hours-card').first().getByRole('button',{name:/Giảm giờ/}).click();
  const action=()=>page.locator('#billing-panel').getByRole('button',{name:calculate?'Tính tiền':'Lưu',exact:true});
  await action().click();
  const pending=page.getByRole('button',{name:calculate?'Đang tính tiền…':'Đang lưu…',exact:true});
  await expect(pending).toBeDisabled();await expect(pending.locator('.button-spinner')).toBeVisible();
  await expect(page.locator('#billing-panel')).toHaveAttribute('aria-busy','true');
  await expect(page.locator('#billing-panel .panel-actions button:enabled')).toHaveCount(0);
  await expect(page.locator('#day-summary')).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>typeof window.failSave)).toBe('function');await page.evaluate(()=>window.failSave());
  await expect(page.locator('#billing-modal-status')).toContainText('Lỗi thử lưu');
  await expect(page.locator('#billing-panel')).toBeVisible();await expect(action()).toBeEnabled();
  await expect(page.getByLabel('Số lượng cầu 1')).toHaveValue('3');
  await page.evaluate(()=>{delete window.finishSave;});
  await action().click();await expect(pending).toBeDisabled();
  await expect.poll(()=>page.evaluate(()=>typeof window.finishSave)).toBe('function');
  await page.evaluate(()=>window.finishSave());
  await expect(page.locator('#billing-panel')).toBeHidden();
  const hero=page.locator('.date-hero #day-summary');
  await expect(hero).toBeVisible();
  for(const label of ['3 quả cầu','2 bình trà','2 người','1,5–2 giờ'])await expect(hero.getByLabel(label,{exact:true})).toBeVisible();
  await expect(page.locator('#billing-status')).not.toContainText('bản nháp');
  if(calculate){await expect(page.locator('#billing-completed')).toBeVisible();await expect(page.locator('#billing-toggle')).toHaveText('Tính tiền lại');}
  await page.reload();await expect(hero.getByLabel('3 quả cầu',{exact:true})).toBeVisible();
  if(calculate)await expect(page.locator('#billing-toggle')).toHaveText('Tính tiền lại');
  await openBilling(page);await page.getByLabel('Số lượng cầu 1').fill('8');await page.keyboard.press('Escape');
  await expect(hero.getByLabel('3 quả cầu',{exact:true})).toBeVisible();
  await page.setViewportSize({width:320,height:700});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`.playwright/billing-hero-${calculate?'calculated':'saved'}.png`,fullPage:true});
});

test('game selection is visible and follows saved mode after reload',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('detail.html?date=2026-12-25&emulator=1');
  await page.getByRole('tab',{name:'Trò chơi',exact:true}).click();
  await expect(page.locator('#games-status')).not.toContainText('Đang tải');
  const wheel=page.getByRole('button',{name:'Vòng quay',exact:true}),mixed=page.getByRole('button',{name:'Chia đội ngẫu nhiên',exact:true});
  await wheel.click();await expect(wheel).toHaveAttribute('aria-pressed','true');await expect(mixed).toHaveAttribute('aria-pressed','false');
  const selectedColor=await wheel.evaluate(b=>getComputedStyle(b).backgroundColor);
  expect(await mixed.evaluate(b=>getComputedStyle(b).backgroundColor)).not.toBe(selectedColor);
  await mixed.click();await expect(mixed).toHaveAttribute('aria-pressed','true');await expect(wheel).toHaveAttribute('aria-pressed','false');
  await page.getByRole('button',{name:'Chia đội',exact:true}).click();await expect(page.locator('#games-status')).toContainText('Đã lưu');
  await page.reload();await expect(mixed).toHaveAttribute('aria-pressed','true');await expect(wheel).toHaveAttribute('aria-pressed','false');
});
