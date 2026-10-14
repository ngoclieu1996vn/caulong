import {expect} from '@playwright/test';
export async function openBilling(page){
  await page.getByRole('tab',{name:'Danh sách',exact:true}).click();
  await page.locator('#billing-toggle').click();
  await expect(page.locator('#billing-login')).toBeVisible();
  await page.getByLabel('Username',{exact:true}).fill('admin');
  await page.getByLabel('Password',{exact:true}).fill('lieuvippro');
  await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
  await expect(page.locator('#billing-panel')).toBeVisible();
}
export async function closeBilling(page){await page.getByRole('button',{name:'Đóng tính tiền',exact:true}).click();}
