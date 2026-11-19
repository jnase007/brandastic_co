import { expect, test } from '@playwright/test'

test('deals reporting uses fake deals and does not invent a close date', async ({ page }) => {
  await page.goto('/dev/deals-reporting')
  await expect(page.getByText('Fake fixture only')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Deal Pipeline' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Reporting' })).toBeVisible()
  await expect(page.getByTestId('deal-report-funnel')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Pipeline alerts' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Lead', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Deal Won' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Deal Lost' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Example Academy', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Review Deal Lost' })).toHaveCount(0)
  await expect(page.getByText('suggest Deal Lost')).toHaveCount(0)

  await expect(page.getByText('70% from the previous stage')).toBeVisible()
  await expect(page.getByLabel('Month view')).toBeVisible()

  const views = [
    ['won-by-source', 'deal-report-won-source'],
    ['cycle', 'deal-report-cycle'],
    ['time-in-stage', 'deal-report-time'],
    ['stalled', 'deal-report-stalled'],
    ['won-lost', 'deal-report-won-lost'],
    ['distribution', 'deal-report-distribution'],
    ['created', 'deal-report-created'],
  ]
  for (const [value, testId] of views) {
    await page.getByLabel('Reporting view').selectOption(value)
    await expect(page.getByTestId(testId)).toBeVisible()
  }
  await page.getByLabel('Reporting view').selectOption('cycle')
  await expect(page.getByTestId('deal-report-empty')).toContainText('Not enough data yet')
  await expect(page.getByRole('heading', { name: 'Lead', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Move to Deal Lost' })).toHaveCount(0)
})
