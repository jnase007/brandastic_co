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
  await expect(page.getByTestId('deal-report-visual')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'At a glance' })).toBeVisible()
  await expect(page.getByTestId('visual-kpi-open')).toContainText('$22,400')
  await expect(page.getByTestId('visual-kpi-weighted')).toContainText('$12,570')
  await expect(page.getByTestId('visual-kpi-win')).toContainText('50%')
  await expect(page.getByTestId('visual-kpi-new')).toContainText('12')
  await expect(page.getByTestId('visual-kpi-average')).toContainText('$3,600')
  await expect(page.getByTestId('visual-kpi-meeting')).toContainText('28.6%')
  await expect(page.getByTestId('deal-report-visual-funnel')).toContainText('$5,700')
  await expect(page.getByTestId('deal-report-visual-donut')).toContainText('Won $7,200')
  await expect(page.getByTestId('deal-report-visual-activity')).toContainText('Created')
  await expect(page.getByTestId('deal-report-visual-owners')).toContainText('Justin')
  await expect(page.getByTestId('deal-report-visual-sources')).toContainText('Referral')
  await expect(page.getByTestId('deal-report-lost-reasons')).toContainText('Budget')
  for (const id of ['deal-report-funnel', 'deal-report-won-source', 'deal-report-distribution', 'deal-report-stalled', 'deal-report-time', 'deal-report-won-lost', 'deal-report-created', 'deal-report-cycle']) {
    await expect(page.getByTestId(id)).toBeVisible()
  }

  await page.getByLabel('Reporting view').selectOption('funnel')
  await expect(page.getByTestId('deal-report-funnel')).toBeVisible()
  await expect(page.getByTestId('deal-report-cycle')).toBeVisible()
  await page.getByLabel('Month view').selectOption('3')
  await expect(page.getByTestId('kpi-total')).toContainText('2')
  await expect(page.getByTestId('visual-kpi-open')).toContainText('$1,500')
  await expect(page.getByTestId('deal-report-funnel')).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  const overflow = await page.evaluate(() => {
    const root = globalThis.document.documentElement
    return root.scrollWidth - root.clientWidth
  })
  expect(overflow).toBeLessThanOrEqual(1)
})
