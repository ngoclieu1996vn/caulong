import {test,expect} from '@playwright/test';
test('saved teams become stale when first confirmed roster is empty',async({page})=>{
  await page.route('**/js/team-games-service.js',route=>route.fulfill({contentType:'text/javascript',body:`
    const person={id:'old',version:'1',name:'Người đã hủy',gender:'Nam',avatar:'./assets/avatars/guest.svg'};
    export const watchTeamGame=(date,onData)=>{queueMicrotask(()=>onData({fromCache:false,data:{
      revision:1,mode:'wheel',participants:[person],sourceFingerprint:JSON.stringify([['old','1','Nam']]),
      genderOverrides:[],drawOrder:['old'],teams:[{id:'team-1',members:[person],kind:'single'}],matchups:[],waitingTeamIds:['team-1']
    }}));return ()=>{};};
  `}));
  await page.goto('detail.html?date=invalid&emulator=1');
  await page.evaluate(async()=>{
    const {createTeamGamesController}=await import('./js/team-games-ui.js');
    const root=document.createElement('div');document.body.append(root);
    window.gamesUnderTest=createTeamGamesController({date:'2026-12-20',root});
    window.gamesUnderTest.setParticipants([],{ready:false});window.gamesUnderTest.start();
  });
  await expect(page.locator('.game-team')).toHaveCount(1);
  await page.evaluate(()=>window.gamesUnderTest.setParticipants([],{ready:true}));
  await expect(page.locator('#games-status')).toContainText('Danh sách đã thay đổi');
  await expect(page.locator('.stale-label')).toBeVisible();
});

for(const gesture of ['double click','held Enter'])test(`reduced motion ${gesture} draws only one participant`,async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('**/js/team-games-service.js',route=>route.fulfill({contentType:'text/javascript',body:`export const watchTeamGame=(date,onData)=>{queueMicrotask(()=>onData({data:null,fromCache:false}));return ()=>{};};`}));
  await page.goto('detail.html?date=invalid&emulator=1');
  await page.evaluate(async()=>{
    const {createTeamGamesController}=await import('./js/team-games-ui.js');
    const root=document.createElement('div');document.body.append(root);
    const controller=createTeamGamesController({date:'2026-12-21',root});
    controller.setParticipants(['a','b','c','d'].map(id=>({id,version:'1',name:id,gender:'Nam',avatar:'./assets/avatars/guest.svg'})),{ready:true});
    controller.start();
  });
  await expect(page.locator('#games-status')).not.toContainText('Đang tải');
  await page.getByRole('button',{name:'Vòng quay',exact:true}).click();
  const draw=page.getByRole('button',{name:'Quay',exact:true});
  if(gesture==='double click'){
    await draw.scrollIntoViewIfNeeded();
    const box=await draw.boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
    await page.mouse.click(x,y);
    await page.waitForTimeout(180);
    await page.mouse.click(x,y,{clickCount:2});
  }
  else{
    await draw.focus();await page.keyboard.down('Enter');
    await expect(page.locator('#draw-order li')).toHaveCount(1);
    await page.keyboard.down('Enter');await page.keyboard.up('Enter');
  }
  await expect(draw).toBeEnabled();
  // Wait for the second animation if an unintended activation slipped through.
  await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,160)));
  await expect(page.locator('#draw-order li')).toHaveCount(1);
});

for(const mode of ['wheel','mixed'])test(`long valid guest names fit ${mode} on a 320px phone`,async({page})=>{
  await page.setViewportSize({width:320,height:850});await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('**/js/team-games-service.js',route=>route.fulfill({contentType:'text/javascript',body:`export const watchTeamGame=(date,onData)=>{queueMicrotask(()=>onData({data:null,fromCache:false}));return ()=>{};};`}));
  await page.goto('detail.html?date=invalid&emulator=1');
  await page.evaluate(async()=>{
    Math.random=()=>0;
    const {createTeamGamesController}=await import('./js/team-games-ui.js');
    const root=document.createElement('div');document.body.append(root);
    const controller=createTeamGamesController({date:'2026-12-21',root});
    controller.setParticipants(['a','b','c'].map(id=>({id,version:'1',name:'A'.repeat(60),gender:'Nam',avatar:'./assets/avatars/guest.svg'})),{ready:true});
    controller.start();
  });
  await expect(page.locator('#games-status')).not.toContainText('Đang tải');
  await page.getByRole('button',{name:mode==='wheel'?'Vòng quay':'Chia đội ngẫu nhiên',exact:true}).click();
  if(mode==='wheel'){await page.getByRole('button',{name:'Quay',exact:true}).click();await expect(page.locator('#draw-order li')).toHaveCount(1);}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
