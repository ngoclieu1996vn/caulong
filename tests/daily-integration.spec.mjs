import {test,expect} from '@playwright/test';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,setDoc,Timestamp} from 'firebase/firestore';
import {openBilling,closeBilling} from './billing-helpers.mjs';
let env;
test.beforeAll(async()=>{
  env=await initializeTestEnvironment({projectId:'demo-calendar-checkin',firestore:{host:'127.0.0.1',port:8080}});
  await env.withSecurityRulesDisabled(async c=>{
    for(const date of ['2026-12-12','2026-12-13','2026-12-14','2026-12-15'])
      for(const [index,gender] of ['Nam','Nữ'].entries())await setDoc(doc(c.firestore(),'checkins',`${date}_${index}`),{date,type:'guest',name:`Bạn ${index+1}`,gender,checkedInAt:Timestamp.fromMillis(1000+index)});
  });
});
test.afterAll(()=>env?.cleanup());
async function open(page,date){await page.goto(`detail.html?date=${date}&emulator=1`);await expect(page.locator('#attendee-count')).toHaveText('2');await expect(page.locator('#billing-status')).not.toContainText('Đang tải');await expect(page.locator('#games-status')).not.toContainText('Đang tải');}
test('billing and games stay independent, roster changes invalidate both',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await open(page,'2026-12-12');
  await openBilling(page);
  await page.getByRole('button',{name:'Lưu & tính tiền'}).click();
  await expect(page.locator('.attendee-amount')).toHaveCount(2);
  await closeBilling(page);
  await page.getByRole('button',{name:'Chia đội ngẫu nhiên',exact:true}).click();
  await page.getByRole('button',{name:'Chia đội',exact:true}).click();
  await expect(page.locator('#games-status')).toContainText('Đã lưu');
  await expect(page.locator('.attendee-amount')).toHaveCount(2);
  await openBilling(page);
  await page.getByLabel('Tiền sân (đ)').fill('200000');
  await page.getByRole('button',{name:'Lưu',exact:true}).click();
  await expect(page.locator('#billing-status')).toContainText('Đã lưu bản nháp');
  await expect(page.locator('.game-team')).toHaveCount(1);
  await page.getByRole('button',{name:'Lưu & tính tiền'}).click();
  await expect(page.locator('.attendee-amount')).toHaveCount(2);
  await closeBilling(page);
  await page.locator('.cancel-checkin').first().click();await page.locator('.delete-confirm').click();
  await expect(page.locator('#attendee-count')).toHaveText('1');
  await expect(page.locator('#billing-status')).toContainText('Cần tính lại');
  await expect(page.locator('#games-status')).toContainText('Danh sách đã thay đổi');
  await expect(page.locator('.attendee-amount')).toHaveCount(0);
});
test('offline cost and game save preserve inputs and permit retry after reconnect',async({page,context})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await open(page,'2026-12-13');
  await openBilling(page);
  await page.getByLabel('Tiền sân (đ)').fill('230000');
  await context.setOffline(true);
  await page.getByRole('button',{name:'Lưu & tính tiền'}).click();
  await expect(page.locator('#billing-status')).toContainText('chưa lưu');
  await expect(page.getByLabel('Tiền sân (đ)')).toHaveValue('230.000');
  await expect(page.locator('.attendee-amount')).toHaveCount(0);
  await closeBilling(page);
  await page.getByRole('button',{name:'Chia đội ngẫu nhiên',exact:true}).click();
  await page.getByRole('button',{name:'Chia đội',exact:true}).click();
  await expect(page.locator('#games-status')).toContainText('chưa lưu');
  await expect(page.locator('.game-team')).toHaveCount(1);
  await context.setOffline(false);
  await page.getByRole('button',{name:'Thử lưu kết quả'}).click();
  await expect(page.locator('#games-status')).toContainText('Đã lưu');
  await openBilling(page);
  await page.getByRole('button',{name:'Lưu & tính tiền'}).click();
  await expect(page.locator('.attendee-amount')).toHaveCount(2);
  await closeBilling(page);
});
test('missing new Rules leaves check-in and cancellation available',async({page})=>{
  for(const [file,watch] of [['billing','watchBilling'],['team-games','watchTeamGame']])
    await page.route(`**/js/${file}-service.js`,route=>route.fulfill({contentType:'text/javascript',body:`export const ${watch}=(date,onData,onError)=>{queueMicrotask(()=>onError({code:'permission-denied'}));return ()=>{};};`}));
  await open(page,'2026-12-14');
  await expect(page.locator('#billing-status')).toContainText('Rules');await expect(page.locator('#games-status')).toContainText('Rules');
  await page.locator('[data-member-id="member_01"] .member-select').click();
  await page.locator('[data-member-id="member_01"] .checkin-button').click();
  await expect(page.locator('#attendee-count')).toHaveText('3');
  await page.locator('.cancel-checkin').first().click();await page.locator('.delete-confirm').click();
  await expect(page.locator('#attendee-count')).toHaveText('2');
});
test('normal wheel animation locks draws and its final sector agrees with winner',async({page})=>{
  await open(page,'2026-12-15');
  await page.getByRole('button',{name:'Vòng quay',exact:true}).click();
  await page.locator('.team-wheel').evaluate(canvas=>{
    const animate=canvas.animate.bind(canvas);
    canvas.animate=(frames,...options)=>{
      window.spinTargetAngle=Number(frames.at(-1).transform.match(/rotate\((.+)deg\)/)[1]);
      return animate(frames,...options);
    };
  });
  await page.getByRole('button',{name:'Quay',exact:true}).evaluate(button=>{button.click();button.click();});
  await expect(page.getByRole('button',{name:'Quay',exact:true})).toBeDisabled();
  await expect(page.locator('#draw-order li')).toHaveCount(2);
  const winner=await page.locator('#draw-order li').first().getAttribute('data-person-id');
  // Completion hides and redraws the wheel when the saved snapshot arrives.
  // Verify the actual animation target, not the reset canvas after saving.
  const angle=await page.evaluate(()=>window.spinTargetAngle);
  const sector=Math.floor((((-angle%360)+360)%360)/180);
  expect(winner).toBe(`2026-12-15_${sector}`);
});
