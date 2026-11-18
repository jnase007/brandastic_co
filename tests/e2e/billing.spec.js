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

test('anonymous subscriptions route redirects to login', async ({ page }) => {
  await page.goto('/billing/subscriptions')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { name: 'Subscriptions', exact: true })).toHaveCount(0)
  await expect(page.getByText('Example SaaS A')).toHaveCount(0)
})

test('anonymous team subscriptions alias redirects to login', async ({ page }) => {
  await page.goto('/team/billing/subscriptions')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByText('Example SaaS A')).toHaveCount(0)
})

test('subscription preview shows the fake fixture on its own view', async ({ page }) => {
  await page.goto('/dev/billing-subscriptions')
  await expect(page.getByRole('heading', { level: 1, name: 'Subscriptions' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Aging report' })).toHaveCount(0)
  await expect(page.getByText('Example SaaS A').first()).toBeVisible()
  await expect(page.getByText('Recurring charges found in QuickBooks. Review what to keep, cancel, or downgrade.')).toBeVisible()
  await expect(page.getByText('Stopped subscriptions stay out of the savings.')).toBeVisible()
})

test('subscription savings math uses the fake fixture', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('brandastic.billing.subscriptionCuts'))
  await page.goto('/dev/billing-subscriptions')
  await page.getByRole('checkbox', { name: 'Select Example SaaS A' }).check()
  await page.getByRole('checkbox', { name: 'Select Example Annual Tool' }).check()
  await expect(page.getByTestId('billing-savings-count')).toHaveText('2')
  await expect(page.getByTestId('billing-savings-monthly')).toHaveText('$69.00')
  await expect(page.getByTestId('billing-savings-annual')).toHaveText('$828.00')
  await expect(page.getByTestId('billing-savings-percent')).toHaveText('13.9%')
  await expect(page.getByRole('checkbox', { name: 'Select Example Stopped Tool' })).toBeDisabled()
  await page.getByRole('button', { name: /^Stopped/ }).click()
  await page.getByRole('button', { name: /^All / }).click()
  await expect(page.getByRole('checkbox', { name: 'Select Example SaaS A' })).toBeChecked()
  await expect(page.getByTestId('billing-savings-monthly')).toHaveText('$69.00')
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
