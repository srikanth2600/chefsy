import { test as setup, expect } from '@playwright/test';

setup('login', async ({ page }) => {

  await page.goto('http://localhost:3005/login');

  await page.fill('input[name="email"]', 'ranuva36@gmail.com');
  await page.fill('input[name="password"]', 'test@123#');

  await page.click('button[type="submit"]');

  await page.waitForURL('**/dashboard');

  await page.context().storageState({ path: 'auth.json' });

});