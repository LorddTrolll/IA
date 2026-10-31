import {
  expect,
  type APIRequestContext,
  type BrowserContext,
} from '@playwright/test';

/** Only the documented fictitious demo account; never production credentials. */
export async function loginDemoAdmin(
  request: APIRequestContext,
  context: BrowserContext,
) {
  const login = await request.post('/api/auth', {
    data: {
      action: 'login',
      email: 'helena@dentim.exemplo',
      password: 'Dentim123!',
    },
  });
  expect(login.ok(), await login.text()).toBeTruthy();
  // Playwright's standalone API request fixture has a separate cookie jar.
  // Share its authenticated cookie with the actual browser context.
  await context.addCookies((await request.storageState()).cookies);
}
