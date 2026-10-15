import {test,expect} from '@playwright/test';

test('cancellation password re-enables after a check-in finishes in another tab panel',async({page})=>{
  for(const [file,watch] of [['billing','watchBilling'],['team-games','watchTeamGame']])await page.route(`**/js/${file}-service.js`,route=>route.fulfill({contentType:'text/javascript',body:`export const ${watch}=(date,cb)=>{queueMicrotask(()=>cb({data:null,fromCache:false}));return ()=>{};};`}));
  await page.route('**/js/checkin-service.js',route=>route.fulfill({contentType:'text/javascript',body:`
    import {getMember} from './members.js';
    const time={toMillis:()=>1000,toDate:()=>new Date(1000)};
    const records=[{id:'guest',date:'2026-11-26',name:'Khách ban đầu',type:'guest',memberId:null,gender:'Nam',checkedInAt:time}];let emit;
    export function watchCheckins(filter,cb){emit=()=>cb({records:[...records],fromCache:false,hasPendingWrites:false});queueMicrotask(emit);return ()=>{};}
    export async function checkInMember(date,id){const member=getMember(id);records.push({id:date+'_'+id,date,name:member.name,memberId:id,type:'member',gender:member.gender,checkedInAt:time});emit();return {alreadyExists:false};}
    export const checkinErrorMessage=error=>error.message;
  `}));
  await page.goto('detail.html?date=2026-11-26&emulator=1#list');
  await expect(page.locator('#attendee-count')).toHaveText('1');await page.locator('.cancel-checkin').click();
  await page.getByRole('tab',{name:'Check-in',exact:true}).click();
  await page.locator('[data-member-id="member_01"] .member-select').click();await page.locator('[data-member-id="member_01"] .checkin-button').click();
  await expect(page.locator('#attendee-count')).toHaveText('2');
  await page.getByRole('tab',{name:'Danh sách',exact:true}).click();
  await expect(page.locator('.cancel-password')).toBeEnabled();await page.locator('.cancel-password').fill('test-only-password');
});

test('cancellation requires the password, keeps it during realtime refresh and forgets it after closing',async({page,context})=>{
  await page.setViewportSize({width:320,height:800});
  const date='2026-11-25';
  await page.goto(`detail.html?date=${date}&emulator=1#list`);
  await expect(page.locator('#data-status')).toContainText('Đã đồng bộ');
  await page.evaluate(async date=>(await import('./js/checkin-service.js')).checkInGuest(date,'Khách mật khẩu','Nam'),date);
  await expect(page.locator('#attendee-count')).toHaveText('1');
  await page.locator('.cancel-checkin').click();
  const password=page.getByLabel('Mật khẩu hủy check-in',{exact:true});
  await expect(password).toBeFocused();
  await page.locator('.delete-confirm').click();await expect(page.locator('.cancel-password-error')).toContainText('Mật khẩu không đúng');
  await expect(page.locator('#attendee-count')).toHaveText('1');
  await password.fill('wrong');await password.press('Enter');await expect(page.locator('.cancel-password-error')).toBeVisible();
  await expect(page.locator('#attendee-count')).toHaveText('1');
  await password.fill('test-only-password');await page.locator('.delete-keep').click();
  await page.locator('.cancel-checkin').click();await expect(password).toHaveValue('');
  await password.fill('test-only-password');await password.press('Home');await password.press('ArrowRight');
  const second=await context.newPage();await second.goto(`detail.html?date=${date}&emulator=1`);
  await expect(second.locator('#data-status')).toContainText('Đã đồng bộ');
  await second.evaluate(async date=>(await import('./js/checkin-service.js')).checkInGuest(date,'Khách đồng bộ','Nữ'),date);
  await expect(page.locator('#attendee-count')).toHaveText('2');
  await expect(password).toHaveValue('test-only-password');await expect(password).toBeFocused();
  expect(await password.evaluate(input=>input.selectionStart)).toBe(1);
  await page.screenshot({path:'.playwright/cancel-password-mobile.png',fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await password.press('Enter');await expect(page.locator('#attendee-count')).toHaveText('1');
  await expect(second.locator('#attendee-count')).toHaveText('1');
  await page.locator('.cancel-checkin').click();await expect(password).toHaveValue('');
  await password.fill('test-only-password');await page.reload();await expect(password).toHaveCount(0);
  await page.locator('.cancel-checkin').click();await expect(password).toHaveValue('');
  await second.close();
});
