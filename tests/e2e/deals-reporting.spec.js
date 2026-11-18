import { expect, test } from '@playwright/test'

test('deals reporting uses fake deals and does not invent a close date', async ({ page }) => {
  await page.goto('/dev/deals-reporting')
  await expect(page.getByText('Fake fixture only')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Deal Pipeline' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Pipeline alerts' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Lead', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Deal Won' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Deal Lost' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Example Academy', exact: true })).toBeVisible()
  await expect(page.getByText('45 days with no Kick-Off')).toBeVisible()
  await expect(page.getByText('160 days since first contact with no Kick-Off')).toBeVisible()

  await page.getByLabel('Reporting').selectOption('funnel')
  await expect(page.getByTestId('deal-report-funnel')).toBeVisible()
  await expect(page.getByText('70% from the previous stage')).toBeVisible()
  await expect(page.getByLabel('Month view')).toBeVisible()

  await page.getByLabel('Reporting').selectOption('cycle')
  await expect(page.getByTestId('deal-report-empty')).toContainText('Not enough data yet')

  await page.getByLabel('Reporting').selectOption('created')
  await expect(page.getByTestId('deal-report-created')).toBeVisible()

  await page.getByLabel('Reporting').selectOption('')
  await page.getByRole('button', { name: 'Review Deal Lost' }).first().click()
  await expect(page.getByRole('heading', { name: 'Move to Deal Lost' })).toBeVisible()
  const save = page.getByRole('button', { name: 'Save Deal Lost' })
  await expect(save).toBeDisabled()
  await page.getByLabel('Lost reason').selectOption('Budget')
  await page.getByLabel('Internal note').fill('Fake note for the preview')
  await page.getByLabel('Follow-up recommendation').fill('Revisit next term')
  await save.click()
  await expect(page.getByRole('heading', { name: 'Move to Deal Lost' })).toBeHidden()
})
