import { test, Page } from '@playwright/test';
import { signIn } from './helpers';

// Captures version-4.0 screens for the project report (synthetic demo data only).
type Who = { tab: 'patient' | 'pharmacy' | 'claims_reviewer'; email: string; staffRole?: string; home: string };

async function snap(page: Page, name: string) {
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `report/${name}.png` });
}

async function as(browser: any, who: Who, fn: (p: Page) => Promise<void>) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await signIn(page, who);
  await page.waitForURL(who.home, { timeout: 20_000 });
  page.setDefaultTimeout(8000);
  try { await fn(page); } catch {} finally { await ctx.close(); }
}

async function visit(page: Page, route: string, name: string) {
  try { await page.goto(route); await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {}); } catch {}
  await snap(page, name);
}

test('report screenshots', async ({ browser, page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await as(browser, { tab: 'patient', email: 'ananya.verma@claimant.example', home: '**/patient/**' }, async (p) => {
    await visit(p, '/patient/dashboard', '03-patient-dashboard');
    await visit(p, '/patient/prescriptions', '04-prescription-upload');
    try {
      await p.getByRole('button', { name: /Load Demo Prescription/ }).click();
      await p.waitForTimeout(1000);
      await p.getByRole('button', { name: /Run Local OCR/ }).click();
      await p.waitForTimeout(20000);
    } catch {}
    await snap(p, '05-prescription-parsed');
    await visit(p, '/patient/reminders', '06-reminders');
    await visit(p, '/patient/nearby-medicines', '07-nearby');
    await p.waitForTimeout(3000); await snap(p, '07-nearby');
    await visit(p, '/patient/health-assistant', '08-assistant');
    try {
      const box = p.getByPlaceholder(/Ask about a medicine/);
      await box.fill('What is Paracetamol used for?'); await box.press('Enter');
      await p.waitForTimeout(9000);
    } catch {}
    await snap(p, '09-assistant-answer');
    await visit(p, '/patient/authenticity', '10-authenticity');
    await visit(p, '/patient/claims', '13-claims');
  });

  await as(browser, { tab: 'pharmacy', email: 'pharmacy@test.com', home: '**/pharmacy/dashboard' }, async (p) => {
    await visit(p, '/pharmacy/dashboard', '20-pharmacy-dashboard');
    await visit(p, '/pharmacy/prescription-queue', '21-prescription-queue');
    await visit(p, '/pharmacy/inventory', '22-inventory');
    await visit(p, '/pharmacy/expiry-risk', '23-expiry-risk');
    await visit(p, '/pharmacy/orders', '24-pharmacy-orders');
  });

  await as(browser, { tab: 'claims_reviewer', staffRole: 'pharmacist', email: 'pharmacist@test.com', home: '**/review-queue' }, async (p) => {
    await visit(p, '/review-queue', '30-review-queue');
    await visit(p, '/cases', '31-cases');
    try { await p.locator('a[href^="/cases/"]').filter({ hasNotText: /new/i }).first().click(); await p.waitForTimeout(4000); await snap(p, '32-case-detail'); } catch {}
    await visit(p, '/assistant', '33-evidence-assistant');
  });

  await as(browser, { tab: 'claims_reviewer', staffRole: 'payer_reviewer', email: 'rohit.mehta@sahyog-health.example', home: '**/payer/**' }, async (p) => {
    await visit(p, '/payer/dashboard', '40-insurer-dashboard');
    await visit(p, '/payer/claims', '41-insurer-claims');
    try { await p.locator('a[href^="/payer/claims/"]').first().click(); await p.waitForTimeout(4000); await snap(p, '42-insurer-claim-detail'); } catch {}
  });

  await as(browser, { tab: 'claims_reviewer', staffRole: 'super_admin', email: 'admin@test.com', home: '**/admin/saas' }, async (p) => {
    await visit(p, '/admin/saas', '50-admin');
  });
});
