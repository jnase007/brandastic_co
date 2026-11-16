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

test('anonymous billing access check does not list emails', async ({ request }) => {
  const response = await request.get('/api/billing-access')
  expect([401, 403]).toContain(response.status())
  const text = await response.text()
  expect(text).not.toContain('@')
  expect(text).not.toContain('allowed":true')
})
