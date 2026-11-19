import { test, expect, Browser } from '@playwright/test';
import { signIn, createVerifiedCaseViaApi } from './helpers';

/**
 * Golden flow: claimant submits a consented claim → insurer reviews, asks a
 * question → claimant answers → insurer records a partial approval → claimant
 * sees the decision. Requires: seeded demo data (npm --prefix backend run seed:demo),
 * backend started with E2E_SETUP_ENABLED=true and E2E_SETUP_KEY set.
 */

async function newPage(browser: Browser) {
  const context = await browser.newContext();
  return context.newPage();
}

test.describe.serial('Claims golden flow (claimant ↔ insurer)', () => {
  let claimReference = '';

  test('setup: an eligible verified case exists', async ({ request }) => {
    await createVerifiedCaseViaApi(request);
  });

  test('claimant submits a claim with explicit consent', async ({ browser }) => {
    const page = await newPage(browser);
    await signIn(page, { tab: 'patient', email: 'patient@test.com' });
    await page.waitForURL('**/patient/dashboard');
    await page.goto('/patient/claims');
    await expect(page.getByRole('heading', { name: 'Insurance Claims' })).toBeVisible();

    await page.getByRole('button', { name: 'New Claim' }).click();
    await page.getByLabel('Claimed Amount (₹) *').fill('500');
    await page.getByLabel('Policy Number *').fill(`SYN-E2E-${Date.now().toString().slice(-6)}`);
    const submit = page.getByRole('button', { name: 'Submit Claim' });
    await expect(submit).toBeDisabled();
    await page.getByLabel('I agree to share this case with the selected insurer.').check();
    await submit.click();

    const toast = page.getByText(/Claim CLM-.* submitted/);
    await expect(toast).toBeVisible();
    claimReference = ((await toast.textContent()) || '').match(/CLM-[A-Z0-9-]+/)?.[0] || '';
    expect(claimReference).not.toBe('');
    await page.context().close();
  });

  test('insurer opens the claim, sees evidence and raises a query', async ({ browser }) => {
    const page = await newPage(browser);
    await signIn(page, { tab: 'claims_reviewer', staffRole: 'payer_reviewer', email: 'insurer@test.com' });
    await page.waitForURL('**/payer/dashboard');
    await page.goto('/payer/claims');
    await page.getByPlaceholder('Claim reference').fill(claimReference);
    await page.getByRole('row', { name: new RegExp(claimReference) }).getByRole('link', { name: 'Open' }).click();

    await expect(page.getByText('Consent valid until')).toBeVisible();
    await page.getByRole('button', { name: 'Start Review' }).click();
    await expect(page.getByText('Under insurer review').first()).toBeVisible();

    await page.getByPlaceholder('Ask for a clarification or a document').fill('Please confirm the number of tablets dispensed.');
    await page.getByRole('button', { name: 'Raise Query' }).click();
    await expect(page.getByText('Waiting for the claimant.')).toBeVisible();
    await page.context().close();
  });

  test('claimant answers the query', async ({ browser }) => {
    const page = await newPage(browser);
    await signIn(page, { tab: 'patient', email: 'patient@test.com' });
    await page.waitForURL('**/patient/dashboard');
    await page.goto('/patient/claims');
    await page.getByRole('button', { name: new RegExp(claimReference) }).click();
    await page.getByPlaceholder('Type your answer').fill('Ten tablets were dispensed as prescribed.');
    await page.getByRole('button', { name: 'Send Answer' }).click();
    await expect(page.getByText('Your answer: Ten tablets were dispensed as prescribed.')).toBeVisible();
    await page.context().close();
  });

  test('insurer records a partial approval with reason and note', async ({ browser }) => {
    const page = await newPage(browser);
    await signIn(page, { tab: 'claims_reviewer', staffRole: 'payer_reviewer', email: 'insurer@test.com' });
    await page.waitForURL('**/payer/dashboard');
    await page.goto('/payer/claims');
    await page.getByPlaceholder('Claim reference').fill(claimReference);
    await page.getByRole('row', { name: new RegExp(claimReference) }).getByRole('link', { name: 'Open' }).click();

    await page.getByRole('button', { name: 'Partial' }).click();
    await page.getByLabel(/Approved amount/).fill('300');
    await page.getByLabel('Reason code').selectOption('QUANTITY_LIMIT');
    await page.getByLabel('Decision note (shared with claimant)').fill('Policy covers up to 300 for this medicine per claim.');
    await page.getByRole('button', { name: 'Record Decision' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Record Decision' }).click();
    await expect(page.getByText('Decision recorded').first()).toBeVisible();
    await page.context().close();
  });

  test('claimant sees the decision and a notification', async ({ browser }) => {
    const page = await newPage(browser);
    await signIn(page, { tab: 'patient', email: 'patient@test.com' });
    await page.waitForURL('**/patient/dashboard');
    await expect(page.getByRole('button', { name: /unread notifications/ })).toBeVisible();
    await page.goto('/patient/claims');
    await page.getByRole('button', { name: new RegExp(claimReference) }).click();
    await expect(page.getByText('Insurer decision · Partially approved')).toBeVisible();
    await expect(page.getByText('Policy covers up to 300 for this medicine per claim.')).toBeVisible();
    await expect(page.getByTestId('appeal-deadline')).toContainText('You can appeal until');
    await page.context().close();
  });

  test('insurer admin cannot settle a partial approval while the claimant can still appeal', async ({ browser }) => {
    const page = await newPage(browser);
    await signIn(page, { tab: 'claims_reviewer', staffRole: 'payer_admin', email: 'insureradmin@test.com' });
    await page.waitForURL('**/payer/**');
    await page.goto('/payer/claims');
    await page.getByPlaceholder('Claim reference').fill(claimReference);
    await page.getByRole('row', { name: new RegExp(claimReference) }).getByRole('link', { name: 'Open' }).click();
    await expect(page.getByTestId('settle-check')).toContainText('Waiting for the claimant to accept or appeal');
    await expect(page.getByRole('button', { name: 'Mark Settled (demo)' })).toBeDisabled();
    await page.context().close();
  });

  test('claimant accepts the partial approval', async ({ browser }) => {
    const page = await newPage(browser);
    await signIn(page, { tab: 'patient', email: 'patient@test.com' });
    await page.waitForURL('**/patient/dashboard');
    await page.goto('/patient/claims');
    await page.getByRole('button', { name: new RegExp(claimReference) }).click();
    await page.getByRole('button', { name: 'Accept Decision' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Accept Decision' }).click();
    await expect(page.getByText(/You accepted this decision on/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Appeal Decision' })).toHaveCount(0);
    await page.context().close();
  });

  test('insurer admin settles the approved ₹300 and the claimant sees it', async ({ browser }) => {
    const admin = await newPage(browser);
    await signIn(admin, { tab: 'claims_reviewer', staffRole: 'payer_admin', email: 'insureradmin@test.com' });
    await admin.waitForURL('**/payer/**');
    await admin.goto('/payer/claims');
    await admin.getByPlaceholder('Claim reference').fill(claimReference);
    await admin.getByRole('row', { name: new RegExp(claimReference) }).getByRole('link', { name: 'Open' }).click();
    await expect(admin.getByText(/Claimant accepted this decision/)).toBeVisible();
    await admin.getByRole('button', { name: 'Mark Settled (demo)' }).click();
    await expect(admin.getByText('Marked settled (simulated)')).toBeVisible();
    await admin.context().close();

    const page = await newPage(browser);
    await signIn(page, { tab: 'patient', email: 'patient@test.com' });
    await page.waitForURL('**/patient/dashboard');
    await page.goto('/patient/claims');
    await page.getByRole('button', { name: new RegExp(claimReference) }).click();
    await expect(page.getByText(/Settled amount/)).toContainText('₹300');
    await page.context().close();
  });
});

test('insurer cannot open the pharmacy case API directly', async ({ request }) => {
  const login = await request.post(`${process.env.E2E_API_URL || 'http://127.0.0.1:5001/api'}/users/login`, {
    data: { email: 'insurer@test.com', password: 'password123', role: 'payer_reviewer' }
  });
  const { token } = await login.json();
  const res = await request.get(`${process.env.E2E_API_URL || 'http://127.0.0.1:5001/api'}/v1/cases`, { headers: { Authorization: `Bearer ${token}` } });
  expect([403, 404]).toContain(res.status());
});
