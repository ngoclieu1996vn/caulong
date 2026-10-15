import {test,expect} from '@playwright/test';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,setDoc,deleteDoc,Timestamp} from 'firebase/firestore';
import {createHash} from 'node:crypto';
let env;
const hash=value=>createHash('md5').update(value).digest('hex');
const configure=data=>env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'settings/admin'),data));
test.beforeAll(async()=>{env=await initializeTestEnvironment({projectId:'demo-calendar-checkin',firestore:{host:'127.0.0.1',port:8080}});});
test.beforeEach(()=>configure({passwordMd5:hash('mật-khẩu-thử')}));
test.afterAll(async()=>{await configure({passwordMd5:hash('test-only-password')});await env.cleanup();});

test('password-only billing reads the current MD5 from Firebase and removes remembered plaintext',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('caulong.billing.credentials',JSON.stringify({username:'admin',password:'old-secret'})));
  await page.goto('detail.html?date=2026-11-27&emulator=1#list');
  await page.locator('#billing-toggle').click();await expect(page.getByLabel('Username',{exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>localStorage.getItem('caulong.billing.credentials'))).toBeNull();
  const password=page.getByLabel('Password',{exact:true});await expect(password).toHaveValue('');
  await password.fill('test-only-password');await password.press('Enter');await expect(page.locator('#billing-login-error')).not.toBeEmpty();
  await expect(page.locator('#billing-panel')).toBeHidden();
  await password.fill('mật-khẩu-thử');await password.press('Enter');await expect(page.locator('#billing-panel')).toBeVisible();
  await page.keyboard.press('Escape');await configure({passwordMd5:hash('mật-khẩu-mới').toUpperCase()});
  await page.locator('#billing-toggle').click();await expect(password).toHaveValue('');
  await password.fill('mật-khẩu-thử');await password.press('Enter');await expect(page.locator('#billing-login-error')).not.toBeEmpty();
  await password.fill('mật-khẩu-mới');await password.press('Enter');await expect(page.locator('#billing-panel')).toBeVisible();
});

test('cancellation uses the same Firebase hash and refuses a changed password',async({page})=>{
  const date='2026-11-28';await page.goto(`detail.html?date=${date}&emulator=1#list`);
  await expect(page.locator('#data-status')).toContainText('Đã đồng bộ');
  await page.evaluate(async date=>(await import('./js/checkin-service.js')).checkInGuest(date,'Khách kiểm tra mật khẩu','Nam'),date);
  await expect(page.locator('#attendee-count')).toHaveText('1');await page.locator('.cancel-checkin').click();
  await page.locator('.cancel-password').fill('test-only-password');await page.locator('.delete-confirm').click();
  await expect(page.locator('.cancel-password-error')).not.toBeEmpty();await expect(page.locator('#attendee-count')).toHaveText('1');
  await configure({passwordMd5:hash('mật-khẩu-mới')});
  await page.locator('.cancel-password').fill('mật-khẩu-thử');await page.locator('.delete-confirm').click();
  await expect(page.locator('.cancel-password-error')).not.toBeEmpty();await expect(page.locator('#attendee-count')).toHaveText('1');
  await page.locator('.cancel-password').fill('mật-khẩu-mới');await page.locator('.cancel-password').press('Enter');
  await expect(page.locator('#attendee-count')).toHaveText('0');
});

test('missing, malformed or offline password configuration cannot unlock billing',async({page,context})=>{
  await page.goto('detail.html?date=2026-11-29&emulator=1#list');await page.locator('#billing-toggle').click();
  const password=page.getByLabel('Password',{exact:true});
  await env.withSecurityRulesDisabled(c=>deleteDoc(doc(c.firestore(),'settings/admin')));
  await password.fill('mật-khẩu-thử');await password.press('Enter');await expect(page.locator('#billing-login-error')).toContainText('cấu hình');
  await configure({passwordMd5:'broken'});await password.fill('mật-khẩu-thử');await password.press('Enter');
  await expect(page.locator('#billing-login-error')).toContainText('cấu hình');
  await configure({passwordMd5:hash('mật-khẩu-thử')});await context.setOffline(true);await password.fill('mật-khẩu-thử');await password.press('Enter');
  await expect(page.locator('#billing-login-error')).toContainText('ngoại tuyến');await expect(page.locator('#billing-panel')).toBeHidden();
  await context.setOffline(false);await password.fill('mật-khẩu-thử');await password.press('Enter');await expect(page.locator('#billing-panel')).toBeVisible();
});

test('closing password confirmation prevents a late verification result from opening billing',async({page})=>{
  await page.route('**/js/admin-password-service.js',route=>route.fulfill({contentType:'text/javascript',body:'export const verifyAdminPassword=()=>new Promise(resolve=>{window.finishPassword=()=>resolve(true);});'}));
  await page.goto('detail.html?date=2026-11-29&emulator=1#list');await page.locator('#billing-toggle').click();
  await page.getByLabel('Password',{exact:true}).fill('test');await page.getByLabel('Password',{exact:true}).press('Enter');
  await expect(page.getByRole('button',{name:'Đang xác nhận…',exact:true})).toBeDisabled();
  await expect.poll(()=>page.evaluate(()=>typeof window.finishPassword)).toBe('function');
  await page.keyboard.press('Escape');await page.locator('#billing-toggle').click();
  await page.evaluate(()=>window.finishPassword());await expect(page.locator('#billing-login')).toBeVisible();
  await expect(page.locator('#billing-panel')).toBeHidden();await expect(page.getByLabel('Password',{exact:true})).toHaveValue('');
});

test('another client deleting a check-in during password verification does not leave a phantom attendee',async({page})=>{
  const date='2026-11-30',id=date+'_external';
  await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'checkins',id),{date,name:'Khách đồng bộ',type:'guest',memberId:null,gender:'Nam',checkedInAt:Timestamp.fromMillis(1000)}));
  await page.route('**/js/admin-password-service.js',route=>route.fulfill({contentType:'text/javascript',body:'export const verifyAdminPassword=()=>new Promise(resolve=>{window.finishPassword=()=>resolve(false);});'}));
  await page.goto(`detail.html?date=${date}&emulator=1#list`);await expect(page.locator('#attendee-count')).toHaveText('1');
  await page.locator('.cancel-checkin').click();await page.locator('.cancel-password').fill('test');await page.locator('.delete-confirm').click();
  await expect.poll(()=>page.evaluate(()=>typeof window.finishPassword)).toBe('function');
  await env.withSecurityRulesDisabled(c=>deleteDoc(doc(c.firestore(),'checkins',id)));
  await expect(page.locator('#attendee-count')).toHaveText('0');
  await page.evaluate(()=>window.finishPassword());await expect(page.locator('.attendee')).toHaveCount(0);
});
