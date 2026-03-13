import { test, expect } from '@playwright/test';

test('Chef can create a new recipe', async ({ page }) => {

  await page.goto('/');

  // Login
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('ranuva36@gmail.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('test@123#');
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Verify login
  await expect(page).toHaveURL(/chef-dashboard/);

  // Navigate to Recipes
  await page.getByRole('button', { name: '🍳 My Recipes' }).click();
  await expect(page.getByRole('button', { name: '+ New Recipe' })).toBeVisible();

  // Open Create Recipe
  await page.getByRole('button', { name: '+ New Recipe' }).click();

});
