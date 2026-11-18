import { test, expect, Browser, Page } from '@playwright/test';
import { signIn, createVerifiedCaseViaApi } from './helpers';

/**
 * Final-year showcase: one synthetic claimant (Ananya Verma) and one fictional insurer
 * (Sahyog Health Assurance (Demo)) go through the whole claim journey, including an appeal.
 * Needs: seed:demo + seed:showcase. Screenshots land in e2e/showcase/ (CI artifact).
 *
 *  1 claimant submits a ₹1,240 claim with consent
 *  2 insurer reviewer starts review and raises a query
 *  3 claimant answers
 *  4 insurer reviewer partly approves ₹1,000
 *  5 claimant sees the decision and appeals
 *  6 a different insurer user (admin) re-reviews and approves in full
 *  7 claimant sees the final decision (also in Hindi)
 */
const CLAIMANT = { tab: 'patient' as const, email: 'ananya.verma@claimant.example' };
const REVIEWER = { tab: 'claims_reviewer' as const, staffRole: 'payer_reviewer', email: 'rohit.mehta@sahyog-health.example' };
const APPEAL_REVIEWER = { tab: 'claims_reviewer' as const, staffRole: 'payer_admin', email: 'kavya.iyer@sahyog-health.example' };
const INSURER = 'Sahyog Health Assurance (Demo)';

let step = 0;
async function shot(page: Page, name: string) {
  step += 1;
  await page.waitForTimeout(400); // let toasts and transitions settle
  await page.screenshot({ path: `showcase/${String(step).padStart(2, '0')}-${name}.png`, fullPage: true });
}

async function as(browser: Browser, who: typeof CLAIMANT | typeof REVIEWER) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await signIn(page, who);
  await page.waitForURL(who.tab === 'patient' ? '**/patient/dashboard' : '**/payer/dashboard');
  return page;
}

async function openInsurerClaim(page: Page, ref: string) {
  await page.goto('/payer/claims');
  await page.getByPlaceholder('Claim reference').fill(ref);
  await page.getByRole('row', { name: new RegExp(ref) }).getByRole('link', { name: 'Open' }).click();
}

test.describe.serial('Showcase: Ananya Verma ↔ Sahyog Health Assurance (Demo)', () => {
  let ref = '';

  test('setup: Ananya has a pharmacist-verified case', async ({ request }) => {
    await createVerifiedCaseViaApi(request, { email: CLAIMANT.email });
  });

  test('1 · claimant submits a ₹1,240 claim with explicit consent', async ({ browser }) => {
    const page = await as(browser, CLAIMANT);
    await shot(page, 'claimant-dashboard');
    await page.goto('/patient/claims');
    await page.getByRole('button', { name: 'New Claim' }).click();
    await page.getByLabel('Insurer *').selectOption({ label: INSURER });
    await page.getByLabel('Claimed Amount (₹) *').fill('1240');
    await page.getByLabel('Policy Number *').fill('SHA-DEMO-2026-0042');
    await page.getByLabel('I agree to share this case with the selected insurer.').check();
    await shot(page, 'claimant-consent-form');
    await page.getByRole('button', { name: 'Submit Claim' }).click();
    const toast = page.getByText(/Claim CLM-.* submitted/);
    await expect(toast).toBeVisible();
    ref = ((await toast.textContent()) || '').match(/CLM-[A-Z0-9-]+/)?.[0] || '';
    expect(ref).not.toBe('');
    await shot(page, 'claimant-claim-submitted');
    await page.context().close();
  });

  test('2 · insurer reviewer starts review and raises a query', async ({ browser }) => {
    const page = await as(browser, REVIEWER);
    await shot(page, 'insurer-dashboard');
    await openInsurerClaim(page, ref);
    await expect(page.getByText('Consent valid until')).toBeVisible();
    await page.getByRole('button', { name: 'Start Review' }).click();
    await expect(page.getByText('Under insurer review').first()).toBeVisible();
    await page.getByPlaceholder('Ask for a clarification or a document').fill('Please confirm how many strips of the antibiotic were dispensed.');
    await page.getByRole('button', { name: 'Raise Query' }).click();
    await expect(page.getByText('Waiting for the claimant.')).toBeVisible();
    await shot(page, 'insurer-query-raised');
    await page.context().close();
  });

  test('3 · claimant answers the query', async ({ browser }) => {
    const page = await as(browser, CLAIMANT);
    await page.goto('/patient/claims');
    await page.getByRole('button', { name: new RegExp(ref) }).click();
    await page.getByPlaceholder('Type your answer').fill('Two strips (20 tablets), as written on the prescription.');
    await page.getByRole('button', { name: 'Send Answer' }).click();
    await expect(page.getByText(/Two strips \(20 tablets\)/)).toBeVisible();
    await shot(page, 'claimant-answered');
    await page.context().close();
  });

  test('4 · insurer reviewer partly approves ₹1,000', async ({ browser }) => {
    const page = await as(browser, REVIEWER);
    await openInsurerClaim(page, ref);
    await page.getByRole('button', { name: 'Partial' }).click();
    await page.getByLabel(/Approved amount/).fill('1000');
    await page.getByLabel('Reason code').selectOption('QUANTITY_LIMIT');
    await page.getByLabel('Decision note (shared with claimant)').fill('Policy covers up to ₹1,000 per prescription for this medicine.');
    await page.getByRole('button', { name: 'Record Decision' }).click();
    await shot(page, 'insurer-confirm-dialog');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Record Decision' }).click();
    await expect(page.getByText('Decision recorded')).toBeVisible();
    await shot(page, 'insurer-partial-approval');
    await page.context().close();
  });

  test('5 · claimant sees the decision and appeals', async ({ browser }) => {
    const page = await as(browser, CLAIMANT);
    await page.goto('/patient/claims');
    await page.getByRole('button', { name: new RegExp(ref) }).click();
    await expect(page.getByText(/Insurer decision · Partially approved/)).toBeVisible();
    await shot(page, 'claimant-sees-partial');
    await page.getByRole('button', { name: 'Appeal Decision' }).click();
    await page.getByLabel(/Why should the decision change/).fill('My policy schedule lists a ₹1,500 limit for prescribed antibiotics; the full ₹1,240 is within it.');
    await shot(page, 'claimant-appeal-form');
    await page.getByRole('button', { name: 'Send Appeal' }).click();
    await expect(page.getByText(/Appeal sent/)).toBeVisible();
    await shot(page, 'claimant-appealed');
    await page.context().close();
  });

  test('6 · a different insurer user re-reviews and approves in full', async ({ browser }) => {
    const page = await as(browser, APPEAL_REVIEWER);
    await openInsurerClaim(page, ref);
    await page.getByRole('button', { name: 'Start Review' }).click();
    await expect(page.getByText('Under insurer review').first()).toBeVisible();
    await page.getByRole('button', { name: 'Approve', exact: true }).click();
    await page.getByLabel('Decision note (shared with claimant)').fill('Appeal accepted: schedule limit confirmed at ₹1,500. Full amount approved.');
    await page.getByRole('button', { name: 'Record Decision' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Record Decision' }).click();
    await expect(page.getByText('Decision recorded')).toBeVisible();
    await shot(page, 'insurer-appeal-approved');
    await page.context().close();
  });

  test('7 · claimant sees the final decision (English and Hindi)', async ({ browser }) => {
    const page = await as(browser, CLAIMANT);
    await page.goto('/patient/claims');
    await page.getByRole('button', { name: new RegExp(ref) }).click();
    await expect(page.getByText(/Insurer decision · Approved/)).toBeVisible();
    await shot(page, 'claimant-final-approved');
    await page.getByLabel('Language').first().selectOption('hi');
    await expect(page.getByRole('heading', { name: 'बीमा दावे' })).toBeVisible();
    await shot(page, 'claimant-final-hindi');
    await page.context().close();
  });
});
