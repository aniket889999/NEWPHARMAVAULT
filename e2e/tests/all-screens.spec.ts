import { test, expect, Page, Browser } from '@playwright/test';
import { signIn } from './helpers';

/**
 * Every screen of every portal opens without a crash, an error screen or a failing API call.
 * Collects all problems first, then fails once with the full list.
 */
type Who = { tab: 'patient' | 'pharmacy' | 'claims_reviewer'; email: string; staffRole?: string; home: string };

const PORTALS: Array<{ who: Who; routes: string[] }> = [
  {
    who: { tab: 'patient', email: 'patient@test.com', home: '**/patient/dashboard' },
    routes: ['dashboard', 'medicines', 'authenticity', 'health-assistant', 'health-tracker', 'reminders', 'comparisons', 'prescriptions', 'cases', 'cart', 'orders', 'doctor-consult', 'nearby-medicines', 'health-records', 'intelligence', 'accessibility', 'claims', 'security'].map((r) => `/patient/${r}`)
  },
  {
    who: { tab: 'pharmacy', email: 'pharmacy@test.com', home: '**/pharmacy/dashboard' },
    routes: ['dashboard', 'inventory', 'orders', 'blockchain', 'expiry-risk', 'stock-risk', 'prescription-queue', 'operations-intelligence', 'workflow-center', 'claims', 'security', 'organization-settings', 'accessibility'].map((r) => `/pharmacy/${r}`)
  },
  {
    who: { tab: 'claims_reviewer', staffRole: 'pharmacist', email: 'pharmacist@test.com', home: '**/review-queue' },
    routes: ['/review-queue', '/cases', '/cases/new', '/assistant', '/account/security', '/staff/claims']
  },
  {
    who: { tab: 'claims_reviewer', staffRole: 'org_admin', email: 'orgadmin@test.com', home: '**/review-queue' },
    routes: ['/review-queue', '/team', '/account/security']
  },
  {
    who: { tab: 'claims_reviewer', staffRole: 'payer_reviewer', email: 'insurer@test.com', home: '**/payer/dashboard' },
    routes: ['/payer/dashboard', '/payer/claims', '/payer/security']
  },
  {
    who: { tab: 'claims_reviewer', staffRole: 'payer_admin', email: 'insureradmin@test.com', home: '**/payer/dashboard' },
    routes: ['/payer/team']
  },
  {
    who: { tab: 'claims_reviewer', staffRole: 'super_admin', email: 'admin@test.com', home: '**/admin/saas' },
    routes: ['/admin/saas', '/research/dashboard', '/research/knowledge-graph', '/research/ai-safety']
  },
  {
    who: { tab: 'claims_reviewer', staffRole: 'research_evaluator', email: 'research@test.com', home: '**/research/dashboard' },
    routes: ['/research/dashboard']
  }
];

const BROKEN_TEXT = /Something went wrong|Server not reachable|Unexpected Application Error|Cannot read properties|is not a function|Failed to fetch/i;

async function checkPortal(browser: Browser, who: Who, routes: string[], problems: string[]) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page: Page = await context.newPage();
  let current = '';
  page.on('pageerror', (err) => problems.push(`${who.email} ${current}: JS error ${err.message.slice(0, 160)}`));
  page.on('response', (res) => {
    const url = res.url();
    if (url.includes('/api/') && res.status() >= 500) problems.push(`${who.email} ${current}: ${res.status()} ${new URL(url).pathname}`);
  });
  await signIn(page, who);
  await page.waitForURL(who.home, { timeout: 20_000 });
  for (const route of routes) {
    current = route;
    await page.goto(route);
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    const url = new URL(page.url()).pathname;
    if (url.startsWith('/login') || url === '/unauthorized') problems.push(`${who.email} ${route}: redirected to ${url}`);
    const text = (await page.locator('body').innerText().catch(() => '')) || '';
    const broken = text.match(BROKEN_TEXT);
    if (broken) problems.push(`${who.email} ${route}: shows "${broken[0]}"`);
    if (text.trim().length < 40) problems.push(`${who.email} ${route}: page is blank`);
  }
  await context.close();
}

test('every screen in every portal opens without errors', async ({ browser }) => {
  test.setTimeout(8 * 60_000);
  const problems: string[] = [];
  for (const { who, routes } of PORTALS) await checkPortal(browser, who, routes, problems);
  expect(problems, `Broken screens:\n${problems.join('\n')}`).toEqual([]);
});
