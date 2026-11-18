import { expect, test } from '@playwright/test'

test('deals reporting uses fake deals and does not invent a close date', async ({ page }) => {
  await page.goto('/dev/deals-reporting')
  await expect(page.getByText('Fake fixture only')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Deal Pipeline' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Pipeline alerts' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Lead', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Deal Won' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Deal Lost' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Example Academy', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Review Deal Lost' })).toHaveCount(0)
  await expect(page.getByText('suggest Deal Lost')).toHaveCount(0)

  await page.getByLabel('Reporting').selectOption('funnel')
  await expect(page.getByTestId('deal-report-funnel')).toBeVisible()
  await expect(page.getByText('70% from the previous stage')).toBeVisible()
  await expect(page.getByLabel('Month view')).toBeVisible()

  await page.getByLabel('Reporting').selectOption('cycle')
  await expect(page.getByTestId('deal-report-empty')).toContainText('Not enough data yet')

  await page.getByLabel('Reporting').selectOption('created')
  await expect(page.getByTestId('deal-report-created')).toBeVisible()

  await page.getByLabel('Reporting').selectOption('')
  await expect(page.getByRole('heading', { name: 'Move to Deal Lost' })).toHaveCount(0)
})
