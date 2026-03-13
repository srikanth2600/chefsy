import { test, expect } from '@playwright/test';

const BASE_URL = "http://localhost:8005";

test('Health API works', async ({ request }) => {

  const response = await request.get(`${BASE_URL}/health`);

  expect(response.status()).toBe(200);

  const data = await response.json();
  expect(data).toBeTruthy();

});