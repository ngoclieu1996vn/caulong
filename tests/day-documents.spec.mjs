import { test, expect } from '@playwright/test';
for(const collectionName of ['billing','teamGames'])test(`${collectionName} rejects stale revisions and preserves the winning write`, async ({page,context})=>{
  await page.goto('index.html?month=2026-12&emulator=1');
  await expect(page.locator('#data-status')).toContainText('Đã đồng bộ');
  const other=await context.newPage();
  await other.goto('index.html?month=2026-12&emulator=1');
  await expect(other.locator('#data-status')).toContainText('Đã đồng bộ');
  const save=(tab,revision,marker)=>tab.evaluate(async ({revision,marker,collectionName})=>{
    try { return await (await import('./js/day-document-service.js')).saveDayDocument(collectionName,'2026-12-01',{marker},revision); }
    catch(e){return e.code;}
  },{revision,marker,collectionName});
  expect(await save(page,0,'initial')).toBe(1);
  const result=await Promise.all([save(page,1,'one'),save(other,1,'two')]);
  expect(result.filter(r=>r===2)).toHaveLength(1);
  expect(result).toContain('revision-conflict');
  expect(await save(page,1,'stale')).toBe('revision-conflict');
  await other.close();
});
