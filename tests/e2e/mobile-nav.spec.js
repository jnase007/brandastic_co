import { test, expect } from '@playwright/test'

async function openMenu(page) {
  await page.goto('/dev/mobile-nav')
  await page.getByRole('button', { name: 'More' }).click()
  await expect(page.getByTestId('mobile-nav-drawer')).toBeVisible()
}

async function assertInView(page, name) {
  const link = page.getByRole('link', { name, exact: true })
  await link.scrollIntoViewIfNeeded()
  const box = await link.boundingBox()
  const viewport = page.viewportSize()
  expect(box).toBeTruthy()
  expect(box.height).toBeGreaterThanOrEqual(44)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1)
  return link
}

async function expectDrawerFits(page) {
  const viewport = page.viewportSize()
  await expect.poll(async () => {
    const drawer = await page.getByTestId('mobile-nav-drawer').boundingBox()
    if (!drawer) return false
    return drawer.y >= -1 && drawer.y + drawer.height <= viewport.height + 1
  }).toBe(true)
}

test.describe('mobile nav', () => {
  test('iPhone 14 menu can scroll to Billing and Subscriptions', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openMenu(page)
    await expectDrawerFits(page)
    const metrics = await page.getByTestId('mobile-nav-scroll').evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }))
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight)
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden')
    const billing = await assertInView(page, 'Billing')
    await assertInView(page, 'Subscriptions')
    await page.screenshot({ path: '/opt/cursor/artifacts/mobile-nav-390.png' })
    await expect(billing).toHaveAttribute('href', '/billing')
    await billing.click()
    await expect(page).toHaveURL(/\/(billing|login)/)
    await expect(page.getByTestId('mobile-nav-drawer')).toHaveCount(0)
  })

  test('short iPhone SE menu can reach Subscriptions', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await openMenu(page)
    await expectDrawerFits(page)
    const subscriptions = await assertInView(page, 'Subscriptions')
    await assertInView(page, 'Billing')
    await page.screenshot({ path: '/opt/cursor/artifacts/mobile-nav-375.png' })
    await expect(subscriptions).toHaveAttribute('href', '/billing/subscriptions')
    await subscriptions.click()
    await expect(page).toHaveURL(/\/(billing\/subscriptions|login)/)
    await expect(page.getByTestId('mobile-nav-drawer')).toHaveCount(0)
  })
})
