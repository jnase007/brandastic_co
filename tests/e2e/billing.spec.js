import { test, expect } from '@playwright/test'

test('anonymous billing page redirects to login', async ({ page }) => {
  await page.goto('/billing')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { name: /^billing$/i })).toHaveCount(0)
  await expect(page.getByText(/fictional/i)).toHaveCount(0)
})

test('anonymous team billing alias redirects to login', async ({ page }) => {
  await page.goto('/team/billing')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByText(/fictional/i)).toHaveCount(0)
})

test('anonymous billing API returns no client data', async ({ request }) => {
  const response = await request.get('/api/billing-data')
  expect([401, 403]).toContain(response.status())
  const headers = response.headers()
  expect(headers['cache-control'] || '').toContain('no-store')
  expect(headers['x-robots-tag'] || '').toContain('noindex')
  const text = await response.text()
  expect(text).not.toContain('monthly_recurring_amount')
  expect(text).not.toContain('Fictional')
  expect(text).not.toContain('SAMPLE-')
})

test('anonymous billing API is 401 and hides subscriptions', async ({ request }) => {
  const response = await request.get('/api/billing-data')
  expect(response.status()).toBe(401)
  const text = await response.text()
  expect(text).not.toContain('subscriptions')
  expect(text).not.toContain('Example SaaS')
  expect(text).not.toContain('typical_monthly_amount')
  expect(text).not.toContain('gz:')
})

test('subscription preview shows the fake fixture under the aging report', async ({ page }) => {
  await page.goto('/dev/billing-subscriptions')
  await expect(page.getByRole('heading', { name: 'Aging report' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Subscriptions', exact: true })).toBeVisible()
  await expect(page.getByText('Example SaaS A').first()).toBeVisible()
  await expect(page.getByText('Recurring charges found in QuickBooks. Review what to keep, cancel, or downgrade.')).toBeVisible()
  const aging = await page.locator('#billing-aging').boundingBox()
  const subscriptions = await page.locator('#billing-subscriptions').boundingBox()
  expect(aging.y).toBeLessThan(subscriptions.y)
})

test('subscription preview empty state does not invent rows', async ({ page }) => {
  await page.goto('/dev/billing-subscriptions?empty=1')
  await expect(page.getByTestId('billing-subscriptions-empty')).toHaveText('No subscription data loaded yet')
  await expect(page.getByText('Example SaaS A')).toHaveCount(0)
})

test('anonymous billing access check does not list emails', async ({ request }) => {
  const response = await request.get('/api/billing-access')
  expect([401, 403]).toContain(response.status())
  const text = await response.text()
  expect(text).not.toContain('@')
  expect(text).not.toContain('allowed":true')
})
