import {test,expect} from '@playwright/test';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,setDoc,deleteDoc,Timestamp} from 'firebase/firestore';
let env;
const seed=async(date,genders)=>env.withSecurityRulesDisabled(async c=>{
  for(const [i,gender] of genders.entries()) await setDoc(doc(c.firestore(),'checkins',`${date}_${i}`),{date,type:'guest',name:`Bạn ${i+1}`,memberId:null,...(gender?{gender}:{}),checkedInAt:Timestamp.fromMillis(1000+i)});
});
test.beforeAll(async()=>{
  env=await initializeTestEnvironment({projectId:'demo-calendar-checkin',firestore:{host:'127.0.0.1',port:8080}});
  await seed('2026-12-06',['Nam','Nữ','Nam','Nữ','Nam']);
  await seed('2026-12-07',['Nam','Nam','Nam','Nam','Nam','Nữ']);
  await seed('2026-12-08',[null,'Nam']);
  await seed('2026-12-09',['Nam','Nữ','Nam']);
  await seed('2026-12-10',['Nam']);
});
test.afterAll(()=>env?.cleanup());
async function open(page,date){
  await page.goto(`detail.html?date=${date}&emulator=1`);
  await expect(page.locator('#data-status')).toContainText('Đã đồng bộ');
  await expect(page.locator('#games-status')).not.toContainText('Đang tải');
}
test('wheel draws everyone once, saves teams and matchups, reload keeps completed result',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await open(page,'2026-12-06');
  await page.getByRole('button',{name:'Vòng quay',exact:true}).click();
  for(let i=0;i<5;i++){
    await page.getByRole('button',{name:'Quay',exact:true}).click();
    await expect(page.locator('#draw-order li')).toHaveCount(i+1);
  }
  await expect(page.locator('#games-status')).toContainText('Đã lưu');
  const ids=await page.locator('#draw-order li').evaluateAll(nodes=>nodes.map(n=>n.dataset.personId));
  expect(new Set(ids).size).toBe(5);
  await expect(page.locator('.game-team')).toHaveCount(3);
  await expect(page.locator('.game-match')).toHaveCount(1);
  await expect(page.locator('.game-waiting')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.game-team')).toHaveCount(3);
  await expect(page.locator('#games-status')).toContainText('Đã lưu');
  await page.screenshot({path:'.playwright/games-desktop.png',fullPage:true});
});
test('mixed animation makes maximal male-female teams and keeps same-gender leftovers',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:320,height:850});
  await open(page,'2026-12-07');
  await page.getByRole('button',{name:'Chia đội ngẫu nhiên',exact:true}).click();
  await page.getByRole('button',{name:'Chia đội',exact:true}).click();
  await expect(page.locator('#games-status')).toContainText('Đã lưu');
  await expect(page.locator('.game-team[data-kind="mixed"]')).toHaveCount(1);
  await expect(page.locator('.game-team[data-kind="same-gender"]')).toHaveCount(2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'.playwright/games-mobile.png',fullPage:true});
});
test('legacy gender choices saved in game only, reload stays current',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await open(page,'2026-12-08');
  await page.getByRole('button',{name:'Chia đội ngẫu nhiên',exact:true}).click();
  await expect(page.getByRole('button',{name:'Chia đội',exact:true})).toBeDisabled();
  await page.getByLabel('Giới tính của Bạn 1').selectOption('Nữ');
  await page.getByRole('button',{name:'Chia đội',exact:true}).click();
  await expect(page.locator('#games-status')).toContainText('Đã lưu');
  await page.reload();
  await expect(page.locator('#games-status')).toContainText('Đã lưu');
  await expect(page.locator('.game-team[data-kind="mixed"]')).toHaveCount(1);
  expect(await page.evaluate(async()=> (await (await import('./js/checkin-service.js')).readDayCheckins('2026-12-08')).find(p=>p.name==='Bạn 1').gender??null)).toBeNull();
});
test('roster changes cancel an animated round and double clicks cannot draw twice',async({page})=>{
  await open(page,'2026-12-09');
  await page.getByRole('button',{name:'Vòng quay',exact:true}).click();
  await page.getByRole('button',{name:'Quay',exact:true}).evaluate(button=>{button.click();button.click();});
  await expect(page.getByRole('button',{name:'Quay',exact:true})).toBeDisabled();
  await env.withSecurityRulesDisabled(c=>deleteDoc(doc(c.firestore(),'checkins','2026-12-09_0')));
  await expect(page.locator('#games-status')).toContainText('Danh sách đã thay đổi');
  await expect(page.locator('#draw-order li')).toHaveCount(0);
  await page.getByRole('button',{name:'Bắt đầu lại'}).click();
  await expect(page.getByRole('button',{name:'Quay',exact:true})).toBeEnabled();
});
test('zero disabled and one participant produces a solo waiting team',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await open(page,'2026-12-11');
  await expect(page.getByRole('button',{name:'Vòng quay',exact:true})).toBeDisabled();
  await open(page,'2026-12-10');
  await page.getByRole('button',{name:'Vòng quay',exact:true}).click();
  await page.getByRole('button',{name:'Quay',exact:true}).click();
  await expect(page.locator('.game-team[data-kind="single"]')).toHaveCount(1);
  await expect(page.locator('.game-waiting')).toHaveCount(1);
  await expect(page.locator('#games-status')).toContainText('Đã lưu');
});
