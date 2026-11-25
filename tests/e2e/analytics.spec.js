import { test, expect } from '@playwright/test'

test('anonymous analytics page redirects to login', async ({ page }) => {
  await page.goto('/analytics')
  await expect(page).toHaveURL(/\/login/, { timeout: 20000 })
  await expect(page.getByRole('heading', { name: /^analytics$/i })).toHaveCount(0)
  await expect(page.getByText(/showing \d+ ranking/i)).toHaveCount(0)
})

test('anonymous analytics API returns no metrics', async ({ request }) => {
  const response = await request.get('/api/analytics-data')
  expect(response.status()).toBe(401)
  const headers = response.headers()
  expect(headers['cache-control'] || '').toContain('no-store')
  expect(headers['x-robots-tag'] || '').toContain('noindex')
  const text = await response.text()
  expect(text).not.toContain('searchVolume')
  expect(text).not.toContain('mention')
  expect(text).not.toContain('oseo_')
})

test('anonymous rank check does not start', async ({ request }) => {
  const response = await request.post('/api/analytics-rank-check?action=start')
  expect([401, 403, 405]).toContain(response.status())
  const text = await response.text()
  expect(text).not.toContain('runId')
})
