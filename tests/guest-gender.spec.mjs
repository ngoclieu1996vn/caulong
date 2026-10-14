import {test,expect} from '@playwright/test';
test('guest gender required and persisted, new member stores configured gender',async({page})=>{
  await page.goto('detail.html?date=2026-12-05&emulator=1');
  await expect(page.locator('#data-status')).toContainText('Đã đồng bộ');
  await page.locator('#guest-toggle').click();
  await page.getByLabel('Họ và tên').fill('Khách Nữ');
  await page.locator('#guest-submit').click();
  await expect(page.locator('#guest-error')).toContainText('giới tính');
  await page.getByLabel('Giới tính', {exact:true}).selectOption('Nữ');
  await page.locator('#guest-submit').click();
  await expect(page.locator('#attendee-count')).toHaveText('1');
  const result=await page.evaluate(async()=> (await (await import('./js/checkin-service.js')).readDayCheckins('2026-12-05')).map(r=>r.gender));
  expect(result).toEqual(['Nữ']);
  await page.evaluate(async()=> (await import('./js/checkin-service.js')).checkInMember('2026-12-05','member_03'));
  // The read helper excludes snapshots still carrying local pending metadata.
  // Wait for the confirmed UI and then verify persisted gender, not an immediate
  // read in the same evaluate call as the write acknowledgement.
  await expect(page.locator('#attendee-count')).toHaveText('2');
  await expect.poll(()=>page.evaluate(async()=>{
    const service=await import('./js/checkin-service.js');
    return (await service.readDayCheckins('2026-12-05')).find(r=>r.type==='member')?.gender;
  })).toBe('Nữ');
});
