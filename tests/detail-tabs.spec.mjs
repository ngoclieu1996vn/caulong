import {test,expect} from '@playwright/test';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,setDoc,Timestamp} from 'firebase/firestore';
import {openBilling,closeBilling} from './billing-helpers.mjs';

test('tabs show one panel, support keyboard/history and fit a phone',async({page})=>{
  await page.setViewportSize({width:320,height:700});
  await page.goto('detail.html?date=2026-12-28&emulator=1');
  const tabs=page.getByRole('tab'),checkin=page.getByRole('tab',{name:'Check-in',exact:true}),list=page.getByRole('tab',{name:'Danh sách',exact:true}),games=page.getByRole('tab',{name:'Trò chơi',exact:true});
  await expect(checkin).toHaveAttribute('aria-selected','true');await expect(tabs).toHaveCount(3);
  await expect(page.getByRole('tabpanel')).toHaveCount(1);await expect(page.locator('#member-grid')).toBeVisible();
  await expect(page.locator('#attendee-list')).toBeHidden();await expect(page.locator('#games-root')).toBeHidden();
  await checkin.focus();await page.keyboard.press('ArrowRight');
  await expect(list).toBeFocused();await expect(list).toHaveAttribute('aria-selected','true');
  await expect(page.locator('#attendee-list')).toBeVisible();await expect(page.locator('#member-grid')).toBeHidden();
  await page.keyboard.press('End');await expect(games).toBeFocused();await expect(page.locator('#games-root')).toBeVisible();
  await page.keyboard.press('Home');await expect(checkin).toBeFocused();
  await list.click();await page.reload();await expect(list).toHaveAttribute('aria-selected','true');
  await games.click();await page.goBack();await expect(list).toHaveAttribute('aria-selected','true');
  expect(new URL(page.url()).searchParams.get('emulator')).toBe('1');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.locator('#data-status')).toContainText('Đã đồng bộ');
  await page.screenshot({path:'.playwright/tabs-list-mobile.png',fullPage:true});
  await page.goto('detail.html?date=2026-12-28&emulator=1#unknown');await expect(checkin).toHaveAttribute('aria-selected','true');
});

test('cancellation restores focus within the visible panel and does not steal it after switching tabs',async({page,context})=>{
  const date='2026-12-30';
  await page.goto(`detail.html?date=${date}&emulator=1#list`);
  await expect(page.locator('#data-status')).toContainText('Đã đồng bộ');
  const checkIn=()=>page.evaluate(async date=>(await import('./js/checkin-service.js')).checkInMember(date,'member_01'),date);
  await checkIn();await expect(page.locator('#attendee-count')).toHaveText('1');
  await page.locator('.cancel-checkin').click();await page.locator('.cancel-password').fill('lieuvippro');await page.locator('.delete-confirm').click();
  await expect(page.locator('#attendee-count')).toHaveText('0');await expect(page.locator('#attendees-title')).toBeFocused();
  await checkIn();await expect(page.locator('#attendee-count')).toHaveText('1');
  await page.locator('.cancel-checkin').click();await page.locator('.cancel-password').fill('lieuvippro');await context.setOffline(true);await page.locator('.delete-confirm').click();
  const checkinTab=page.getByRole('tab',{name:'Check-in',exact:true});await checkinTab.click();
  await context.setOffline(false);await expect(page.locator('#attendee-count')).toHaveText('0');
  await expect(checkinTab).toBeFocused();
});

test('Back and Forward defer a tab change until the open modal closes',async({page})=>{
  await page.goto('detail.html?date=2026-12-31&emulator=1');
  await expect(page.locator('#data-status')).toContainText('Đã đồng bộ');
  const checkin=page.getByRole('tab',{name:'Check-in',exact:true}),list=page.getByRole('tab',{name:'Danh sách',exact:true});
  await list.click();await openBilling(page);await page.goBack();
  await expect(page.locator('#billing-panel')).toBeVisible();await expect(list).toHaveAttribute('aria-selected','true');
  await closeBilling(page);await expect(checkin).toHaveAttribute('aria-selected','true');await expect(checkin).toBeFocused();
  await page.locator('#member-grid .avatar-trigger').first().click();await page.goForward();
  await expect(page.locator('.avatar-viewer')).toBeVisible();await expect(checkin).toHaveAttribute('aria-selected','true');
  await page.keyboard.press('Escape');await expect(list).toHaveAttribute('aria-selected','true');await expect(list).toBeFocused();
});

test('switching tabs keeps guest and billing edits, live roster and running games',async({page})=>{
  const env=await initializeTestEnvironment({projectId:'demo-calendar-checkin',firestore:{host:'127.0.0.1',port:8080}});
  const date='2026-12-29';
  try{
    await env.withSecurityRulesDisabled(async c=>{for(const [i,gender] of ['Nam','Nữ'].entries())await setDoc(doc(c.firestore(),'checkins',`${date}_${i}`),{date,name:`Khách ${i}`,type:'guest',gender,memberId:null,checkedInAt:Timestamp.fromMillis(1000+i)});});
    await page.goto(`detail.html?date=${date}&emulator=1`);
    await expect(page.locator('#data-status')).toContainText('Đã đồng bộ');
    await page.locator('#guest-toggle').click();await page.getByLabel('Họ và tên').fill('Khách chưa gửi');await page.getByLabel('Giới tính',{exact:true}).selectOption('Nữ');
    await page.getByRole('tab',{name:'Danh sách',exact:true}).click();await openBilling(page);
    await page.getByLabel('Tiền sân (đ)').fill('250000');await closeBilling(page);
    await page.getByRole('tab',{name:'Trò chơi',exact:true}).click();
    await page.getByRole('button',{name:'Vòng quay',exact:true}).click();await page.getByRole('button',{name:'Quay',exact:true}).click();
    await page.getByRole('tab',{name:'Check-in',exact:true}).click();
    await expect(page.getByLabel('Họ và tên')).toHaveValue('Khách chưa gửi');await expect(page.getByLabel('Giới tính',{exact:true})).toHaveValue('Nữ');
    await expect(page.locator('#games-status')).toContainText('Đã lưu',{timeout:10000});
    await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'checkins',`${date}_extra`),{date,name:'Khách mới',type:'guest',gender:'Nam',checkedInAt:Timestamp.fromMillis(2000)}));
    await expect(page.locator('#date-count')).toContainText('3 người');
    await page.getByRole('tab',{name:'Danh sách',exact:true}).click();await expect(page.locator('#attendee-list')).toContainText('Khách mới');
    await openBilling(page);await expect(page.getByLabel('Tiền sân (đ)')).toHaveValue('250.000');await closeBilling(page);
    await page.getByRole('tab',{name:'Trò chơi',exact:true}).click();await expect(page.locator('#games-status')).toContainText('Danh sách đã thay đổi');
    await page.screenshot({path:'.playwright/tabs-games-desktop.png',fullPage:true});
  }finally{await env.cleanup();}
});
