import { expect, test } from '@playwright/test'

test('deal reporting is its own page and labels percentages', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 })
  await page.goto('/dev/deals-reporting')
  await expect(page.getByText('Fake fixture only')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Reporting' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Deal Pipeline' })).toHaveCount(0)
  await expect(page.getByTestId('deal-report-funnel')).toBeVisible()
  await expect(page.getByText('20%')).toBeVisible()
  await expect(page.getByText('70% from the previous stage')).toBeVisible()
  await expect(page.getByTestId('deal-report-won-source')).toContainText('50% share')
  await expect(page.getByTestId('deal-report-won-source')).toContainText('100% win')
  await expect(page.getByTestId('deal-report-distribution')).toContainText('25%')
  await expect(page.getByTestId('deal-report-stalled')).toContainText('33.3%')
  await expect(page.getByTestId('kpi-cycle')).toContainText('—')
  await expect(page.getByTestId('deal-report-empty')).toContainText('Not enough data yet')

  await page.getByLabel('Reporting view').selectOption('funnel')
  await expect(page.getByTestId('deal-report-funnel')).toBeVisible()
  await page.getByLabel('Month view').selectOption('3')
  await expect(page.getByTestId('kpi-total')).toContainText('2')
})
