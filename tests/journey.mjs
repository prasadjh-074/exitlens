import { chromium, expect } from '@playwright/test'
import { cp, mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../', import.meta.url)),
  demo = 'http://127.0.0.1:4173'
const temp = await mkdtemp(path.join(tmpdir(), 'exitlens-e2e-')),
  ext = path.join(temp, 'extension')
let context
async function launch() {
  context = await chromium.launchPersistentContext(path.join(temp, 'profile'), {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1360, height: 920 },
    ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--disable-extensions-except=' + ext, '--load-extension=' + ext],
  })
  return (
    context.serviceWorkers()[0] ??
    context.waitForEvent('serviceworker', { timeout: 20000 })
  )
}
try {
  if (!(await fetch(demo)).ok)
    throw Error('Start npm run demo before running this test.')
  await cp(path.join(root, 'extension/dist'), ext, { recursive: true })
  // Browser-chrome prompts are outside Playwright's DOM. Grant only our two local hosts
  // in this temporary test copy. The application opt-in still runs through its normal UI.
  const mf = JSON.parse(await readFile(path.join(ext, 'manifest.json'), 'utf8'))
  mf.host_permissions = ['http://127.0.0.1/*', 'http://localhost/*']
  mf.permissions.push('webRequest')
  delete mf.optional_permissions
  await writeFile(path.join(ext, 'manifest.json'), JSON.stringify(mf))
  let worker = await launch()
  const ui = await context.newPage(),
    site = await context.newPage()
  const base = worker.url().split('/').slice(0, 3).join('/'),
    errors = []
  ui.on('pageerror', (e) => errors.push(e.message))
  site.on('pageerror', (e) => errors.push(e.message))
  const records = () =>
    worker.evaluate(
      async () =>
        (await chrome.storage.local.get('memory')).memory?.records ?? [],
    )
  const ready = async (pattern) =>
    expect
      .poll(
        () =>
          worker.evaluate(
            async (p) =>
              Object.values(await chrome.storage.session.get(null)).some(
                (t) => t.last?.page === p,
              ),
            demo + pattern,
          ),
        { timeout: 12000 },
      )
      .toBe(true)
  const shot = async (page, name) => {
    if (process.env.EXITLENS_SCREENSHOTS) {
      await mkdir(process.env.EXITLENS_SCREENSHOTS, { recursive: true })
      await page.screenshot({
        path: path.join(process.env.EXITLENS_SCREENSHOTS, name + '.png'),
      })
    }
  }
  await ui.goto(base + '/dashboard.html')
  await site.goto(demo + '/stillframe')
  await site
    .getByRole('button', { name: 'Customise preferences', exact: true })
    .click()
  expect(await records()).toHaveLength(0)
  await ui.getByRole('button', { name: 'Enable a site', exact: true }).click()
  await ui.getByRole('button', { name: 'Enable recording' }).click()
  await ready('/stillframe')

  // Replay controls depict the same site actions, but must leave real extension history alone.
  const studio = await context.newPage()
  studio.on('pageerror', (e) => errors.push(e.message))
  await studio.goto(demo)
  await expect(
    studio.getByRole('heading', { name: 'The web’s missing undo button.' }),
  ).toBeVisible()
  await shot(studio, 'presentation')
  for (const label of [
    'View trial offer',
    'Start free trial',
    'Find undo path',
    'Account settings',
    'Manage subscription',
    'Cancel plan',
    'Continue cancellation',
  ])
    await studio.getByRole('button', { name: label, exact: true }).click()
  await expect(studio.getByText('Guide paused', { exact: true })).toBeVisible()
  for (const label of [
    'Use accessible verification',
    'Complete human verification',
    'Continue to confirmation',
    'Confirm cancellation',
  ])
    await studio.getByRole('button', { name: label, exact: true }).click()
  await expect(
    studio.getByRole('heading', { name: 'Cancellation verified' }),
  ).toBeVisible()
  await expect(studio.getByText('4.00×', { exact: true })).toBeVisible()
  await shot(studio, 'presentation-report')
  expect(await records()).toHaveLength(0)
  await studio.getByRole('button', { name: 'Reset walkthrough' }).click()
  await expect(
    studio.getByRole('button', { name: 'Previous step' }),
  ).toBeDisabled()
  await studio.close()

  await site
    .getByRole('button', { name: 'Reject cookies', exact: true })
    .click()
  await expect
    .poll(
      async () =>
        (await records()).find((r) => r.action === 'Reject cookies')
          ?.inconsistent,
      { timeout: 12000 },
    )
    .toBe(true)
  await site.getByRole('link', { name: 'View trial offer' }).click()
  await ready('/trial')
  await site.getByRole('button', { name: 'Start free trial' }).click()
  await ready('/welcome')
  await expect
    .poll(
      async () =>
        (await records()).find((r) => r.action === 'Start free trial')?.status,
    )
    .toBe('Active')
  await ui.getByRole('button', { name: 'Overview', exact: true }).click()
  await shot(ui, 'dashboard')
  const card = ui.locator('article').filter({ hasText: 'Start free trial' })
  await card.getByRole('button', { name: 'Find Undo Path' }).click()
  await expect(ui.getByText('Reversal graph', { exact: true })).toBeVisible()
  await ui.getByRole('button', { name: 'Start or resume guide' }).click()
  async function follow(route, label, role = 'link') {
    await ready(route)
    await expect(site.locator('#exitlens-guidance')).toContainText(
      'Next step',
      { timeout: 12000 },
    )
    const control = site
      .getByRole(role, { name: label, exact: true })
      .and(site.locator('[data-exitlens-highlight]'))
    await expect(control).toBeVisible()
    await control.click()
  }
  await follow('/welcome', 'Account settings')
  await follow('/account', 'Manage subscription')
  await follow('/subscription', 'Cancel plan')
  await follow('/retention', 'Continue cancellation')
  await ready('/verify')
  await expect(site.locator('#exitlens-guidance')).toContainText(
    'Paused for human verification',
  )
  // The test operator chooses the fictional site's own accessible, input-free alternative.
  await site
    .getByRole('button', { name: 'Use accessible verification' })
    .click()
  await site
    .locator('.alternative')
    .getByRole('button', { name: 'Complete human verification' })
    .click()
  await follow('/verify', 'Continue to confirmation')
  await follow('/confirm', 'Confirm cancellation', 'button')
  await expect(
    site.getByRole('heading', { name: 'Your subscription is cancelled.' }),
  ).toBeVisible()
  await expect
    .poll(
      async () =>
        (await records()).find((r) => r.action === 'Start free trial')
          ?.verification,
    )
    .toBe('Verified by observable evidence')
  const record = (await records()).find((r) => r.action === 'Start free trial')
  expect(record.terms.recurring).toBe('₹799')
  expect(record.entry).toHaveLength(2)
  expect(record.reversal.length).toBeGreaterThanOrEqual(7)
  expect(record.edges.some((e) => e.proof === 'Observed')).toBe(true)
  expect(record.barriers.some((b) => b.includes('Human verification'))).toBe(
    true,
  )
  await shot(ui, 'reversal-graph')
  await ui.getByRole('button', { name: 'Report', exact: true }).click()
  await shot(ui, 'report')
  const side = await context.newPage()
  await side.setViewportSize({ width: 375, height: 800 })
  await side.goto(base + '/sidepanel.html')
  await expect(
    side.getByRole('heading', { name: 'Commitment overview' }),
  ).toBeVisible()
  expect(
    await side.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await shot(side, 'side-panel')
  expect(errors).toEqual([])
  await context.close()
  context = undefined
  worker = await launch()
  await expect
    .poll(async () => (await records()).find((r) => r.id === record.id)?.status)
    .toBe('Reversed')
  console.log(
    'PASS: isolated presentation replay, opt-in, simulated tracker, trial terms, real clicks, graph, checkpoint, receipt, narrow panel and restart persistence.',
  )
} finally {
  await context?.close()
  await rm(temp, { recursive: true, force: true })
}
