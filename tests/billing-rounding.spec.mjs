import {test,expect} from '@playwright/test';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,Timestamp} from 'firebase/firestore';
import {buildParticipants,rosterFingerprint} from '../js/participants.js';
import {createBillingInput} from '../js/billing.js';
import {openBilling} from './billing-helpers.mjs';
let env;
const date='2026-12-28';
test.beforeAll(async()=>{
  env=await initializeTestEnvironment({projectId:'demo-calendar-checkin',firestore:{host:'127.0.0.1',port:8080}});
  await env.withSecurityRulesDisabled(async c=>{
    const records=Array.from({length:6},(_,i)=>({id:`${date}_${i}`,date,name:`Guest ${i}`,type:'guest',gender:'Nam',checkedInAt:Timestamp.fromMillis(1000+i)}));
    for(const {id,...record} of records)await setDoc(doc(c.firestore(),'checkins',id),record);
    const participants=buildParticipants(records),input=createBillingInput(participants);
    input.shuttles[0].quantity=3;input.tea.quantity=1;
    await setDoc(doc(c.firestore(),'billing',date),{revision:1,status:'calculated',input,participants,sourceFingerprint:rosterFingerprint(participants),
      result:{total:321000,allocations:participants.map((p,i)=>({id:p.id,version:p.version,halfHours:4,amount:[53499,53499,53501,53501,53500,53500][i]}))}});
  });
});
test.afterAll(()=>env?.cleanup());
test('old bills stay unchanged until recalculation, then equal hours pay equally with visible surplus',async({page})=>{
  await page.goto(`detail.html?date=${date}&emulator=1#list`);
  await expect(page.locator('.attendee-amount')).toHaveCount(6);
  expect((await page.locator('.attendee-amount').allTextContents()).map(t=>t.replace(/\D/g,''))).toEqual(['53499','53499','53501','53501','53500','53500']);
  await expect(page.locator('#billing-status')).toContainText('Tính tiền lại để làm tròn');
  await openBilling(page);
  await expect(page.locator('#billing-summary')).toContainText('Tổng thu sau làm tròn');
  await expect(page.locator('#billing-summary')).toContainText('324.000');
  await page.locator('#billing-panel').getByRole('button',{name:'Tính tiền',exact:true}).click();
  await expect(page.locator('#billing-panel')).toBeHidden();
  await expect(page.locator('#billing-status')).toContainText('Tổng thu 324.000');
  await expect(page.locator('#day-summary')).toContainText('Tổng chi 321.000');
  await expect(page.locator('#day-summary')).toContainText('Dư do làm tròn 3.000');
  expect((await page.locator('.attendee-amount').allTextContents()).map(t=>t.replace(/\D/g,''))).toEqual(Array(6).fill('54000'));
  await env.withSecurityRulesDisabled(async c=>{
    const result=(await getDoc(doc(c.firestore(),'billing',date))).data().result;
    expect(result.collectedTotal).toBe(324000);expect(result.roundingDifference).toBe(3000);expect(result.roundingUnit).toBe(1000);
  });
  await page.reload();
  await expect(page.locator('.attendee-amount')).toHaveCount(6);
  expect((await page.locator('.attendee-amount').allTextContents()).map(t=>t.replace(/\D/g,''))).toEqual(Array(6).fill('54000'));
  await expect(page.locator('#day-summary')).toContainText('Dư do làm tròn 3.000');
});
