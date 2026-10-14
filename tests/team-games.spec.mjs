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
  await seed('2026-12-24',['Nam','Nữ']);
});
test.afterAll(()=>env?.cleanup());
async function open(page,date){
  await page.goto(`detail.html?date=${date}&emulator=1#games`);
  await expect(page.locator('#data-status')).toContainText('Đã đồng bộ');
  await expect(page.locator('#games-status')).not.toContainText('Đang tải');
}
test('wheel draws everyone once, saves teams and matchups, reload keeps completed result',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await open(page,'2026-12-06');
  await page.getByRole('button',{name:'Vòng quay',exact:true}).click();
  await expect(page.locator('.wheel-winner')).toHaveCount(0);
  await expect(page.locator('.wheel-stage').getByRole('button',{name:'Quay',exact:true})).toHaveCount(1);
  await expect(page.locator('.panel-actions').getByRole('button',{name:'Quay',exact:true})).toHaveCount(0);
  await expect(page.locator('.games-heading').getByRole('button',{name:'Bắt đầu lại',exact:true})).toHaveText('↻');
  const centered=await page.locator('.wheel-stage').evaluate(stage=>{
    const rect=stage.getBoundingClientRect(),button=stage.querySelector('button').getBoundingClientRect();
    return Math.abs(rect.x+rect.width/2-button.x-button.width/2)<2&&Math.abs(rect.y+rect.height/2-button.y-button.height/2)<2;
  });
  expect(centered).toBe(true);
  for(let i=0;i<4;i++){
    await page.getByRole('button',{name:'Quay',exact:true}).click();
    await expect(page.locator('#draw-order li')).toHaveCount(i===3?5:i+1);
    if(i<3){
      await expect(page.locator('.game-team')).toHaveCount(Math.ceil((i+1)/2));
      await expect(page.locator('.team-pending-slot')).toHaveCount((i+1)%2);
      if(i===0){
        await page.locator('.game-team .avatar-trigger').first().click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toBeHidden();
        await page.locator('#games-panel').screenshot({path:'.playwright/wheel-progress.png'});
      }
    }
  }
  await expect(page.locator('#games-status')).toContainText('Đã lưu');
  const ids=await page.locator('#draw-order li').evaluateAll(nodes=>nodes.map(n=>n.dataset.personId));
  expect(new Set(ids).size).toBe(5);
  await expect(page.locator('.game-team')).toHaveCount(3);
  await expect(page.locator('.game-match')).toHaveCount(1);
  await expect(page.locator('.game-waiting')).toHaveCount(1);
  await expect(page.locator('.wheel-stage')).toBeHidden();
  await expect(page.getByRole('button',{name:'Quay',exact:true})).toBeHidden();
  await expect(page.locator('#draw-order')).toBeHidden();
  await expect(page.locator('.wheel-results-summary')).toContainText('3 đội');
  await page.getByText('Xem thứ tự quay', {exact:true}).click();
  await expect(page.locator('#draw-order')).toBeVisible();
  await page.reload();
  await expect(page.locator('.game-team')).toHaveCount(3);
  await expect(page.locator('#games-status')).toContainText('Đã lưu');
  await expect(page.locator('.wheel-stage')).toBeHidden();
  await page.locator('#games-panel').screenshot({path:'.playwright/wheel-results-desktop.png'});
  await page.setViewportSize({width:320,height:850});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#games-panel').screenshot({path:'.playwright/wheel-results-mobile.png'});
  await page.getByRole('button',{name:'Bắt đầu lại'}).click();
  await expect(page.locator('.wheel-stage')).toBeVisible();
  await expect(page.locator('.game-team')).toHaveCount(0);
  await expect(page.locator('.wheel-winner')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Quay',exact:true})).toBeEnabled();
});

test('two participants finish after one spin, last player is included automatically',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await open(page,'2026-12-24');
  await page.getByRole('button',{name:'Vòng quay',exact:true}).click();
  await page.locator('.team-wheel').evaluate(canvas=>{
    window.spinCount=0;const animate=canvas.animate.bind(canvas);
    canvas.animate=(...args)=>{window.spinCount++;return animate(...args);};
  });
  await page.getByRole('button',{name:'Quay',exact:true}).click();
  await expect(page.locator('#draw-order li')).toHaveCount(2);
  await expect(page.locator('#games-status')).toContainText('Đã lưu');
  await expect(page.locator('.game-team')).toHaveCount(1);
  await expect(page.locator('.game-team .team-person')).toHaveCount(2);
  expect(await page.evaluate(()=>window.spinCount)).toBe(1);
  const ids=await page.locator('#draw-order li').evaluateAll(items=>items.map(item=>item.dataset.personId));
  expect(new Set(ids).size).toBe(2);
  await page.reload();
  await expect(page.locator('.game-team .team-person')).toHaveCount(2);
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
