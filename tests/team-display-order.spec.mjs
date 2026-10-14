import {test,expect} from '@playwright/test';

for(const mode of ['wheel','mixed'])test(`saved ${mode} team cards use numeric order without changing members or matchups`,async({page})=>{
  const participants=Array.from({length:20},(_,i)=>({id:`p${String(i+1).padStart(2,'0')}`,version:'1',name:`Người ${i+1}`,gender:'Nam',avatar:'./assets/avatars/guest.svg'}));
  const data={revision:1,schemaVersion:1,mode,participants,genderOverrides:[],drawOrder:mode==='wheel'?participants.map(p=>p.id):[],
    sourceFingerprint:JSON.stringify(participants.map(p=>[p.id,p.version,p.gender])),
    teams:[2,10,3,1,4,5,6,7,8,9].map(n=>({id:`team-${n}`,kind:'same-gender',members:participants.slice((n-1)*2,n*2)})),
    matchups:[[10,2],[3,1],[4,5],[6,7],[8,9]].map((pair,i)=>({id:`match-${i+1}`,teamIds:pair.map(n=>`team-${n}`)})),waitingTeamIds:[]};
  await page.route('**/js/team-games-service.js',route=>route.fulfill({contentType:'text/javascript',body:`export const watchTeamGame=(date,cb)=>{queueMicrotask(()=>cb({fromCache:false,data:${JSON.stringify(data)}}));return ()=>{};};`}));
  await page.route('**/js/checkin-service.js',route=>route.fulfill({contentType:'text/javascript',body:'export const readDayCheckins=async()=>[];'}));
  await page.goto('detail.html?date=invalid&emulator=1');
  await page.evaluate(async participants=>{
    const {createTeamGamesController}=await import('./js/team-games-ui.js');
    const root=document.createElement('div');document.body.append(root);
    const controller=createTeamGamesController({date:'2026-12-31',root});controller.setParticipants(participants,{ready:true});controller.start();
  },participants);
  await expect(page.locator('.game-team h4')).toHaveText(['Đội 1','Đội 2','Đội 3','Đội 4','Đội 5','Đội 6','Đội 7','Đội 8','Đội 9','Đội 10']);
  await expect(page.locator('.game-team').first().locator('.team-person > span')).toHaveText(['Người 1','Người 2']);
  await expect(page.locator('.game-team').last().locator('.team-person > span')).toHaveText(['Người 19','Người 20']);
  await expect(page.locator('.game-match').first()).toHaveText('Đội 10  ×  Đội 2');
});
