import { test, expect, Browser, Page } from '@playwright/test';
import { signIn, API, DEMO_PASSWORD } from './helpers';

/**
 * The live-demo path on seeded data only (seed:demo + seed:showcase), with no test shortcuts:
 * Ananya claims against her pharmacist-verified case PV-DEMO-ANANYA-002, which carries real
 * synthetic evidence. The insurer sees documents, fields, signals, the pharmacist's decision and
 * the bill check, decides, and the insurer admin settles (simulated).
 */
const CLAIMANT = { tab: 'patient' as const, email: 'ananya.verma@claimant.example' };
const REVIEWER = { tab: 'claims_reviewer' as const, staffRole: 'payer_reviewer', email: 'rohit.mehta@sahyog-health.example' };
const ADMIN = { tab: 'claims_reviewer' as const, staffRole: 'payer_admin', email: 'kavya.iyer@sahyog-health.example' };
const CASE_REF = 'PV-DEMO-ANANYA-002';

async function as(browser: Browser, who: { tab: 'patient' | 'claims_reviewer'; email: string; staffRole?: string }): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await signIn(page, who);
  await page.waitForURL(who.tab === 'patient' ? '**/patient/**' : '**/payer/**');
  return page;
}

test.describe.serial('Demo claim on seeded evidence: claimant → insurer → settlement', () => {
  let ref = '';

  test('a claim larger than the verified bill is refused by the server', async ({ request }) => {
    const login = await request.post(`${API}/users/login`, { data: { email: CLAIMANT.email, password: DEMO_PASSWORD, role: 'patient' } });
    expect(login.ok()).toBeTruthy();
    const token = (await login.json()).token as string;
    const auth = { Authorization: `Bearer ${token}` };
    const cases = await (await request.get(`${API}/v1/claims/eligible-cases`, { headers: auth })).json();
    const demo = cases.find((c: { caseReference: string }) => c.caseReference === CASE_REF);
    expect(demo, 'seeded verified case is eligible').toBeTruthy();
    expect(demo.invoiceTotal).toBe(230);
    const payers = await (await request.get(`${API}/v1/claims/payers`, { headers: auth })).json();
    const res = await request.post(`${API}/v1/claims`, {
      headers: auth,
      data: { caseId: demo.id, payerOrganizationId: payers[0].id, claimedAmount: 500, policyNumber: 'SYN-POL-OVER', consent: { accepted: true } }
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).code).toBe('CLAIM_EXCEEDS_INVOICE');
  });

  test('claimant sees the bill total and submits a claim within it', async ({ browser }) => {
    const page = await as(browser, CLAIMANT);
    await page.goto('/patient/claims');
    await page.getByRole('button', { name: 'New Claim' }).click();
    const value = await page.locator('#claim-case option', { hasText: CASE_REF }).getAttribute('value');
    await page.getByLabel('Verified Case *').selectOption(value!);
    await expect(page.getByText(/Verified pharmacy bill/)).toContainText('230');
    await page.getByLabel('Insurer *').selectOption({ label: 'Sahyog Health Assurance (Demo)' });
    await page.getByLabel('Claimed Amount (₹) *').fill('230');
    await page.getByLabel('Policy Number *').fill('SYN-POL-24018');
    await page.getByLabel('I agree to share this case with the selected insurer.').check();
    await page.getByRole('button', { name: 'Submit Claim' }).click();
    const toast = page.getByText(/Claim CLM-.* submitted/);
    await expect(toast).toBeVisible();
    ref = ((await toast.textContent()) || '').match(/CLM-[A-Z0-9-]+/)?.[0] || '';
    expect(ref).not.toBe('');
    await page.context().close();
  });

  test('insurer sees the real evidence, the pharmacist decision and the bill check', async ({ browser }) => {
    const page = await as(browser, REVIEWER);
    await page.goto('/payer/claims');
    await page.getByPlaceholder('Claim reference').fill(ref);
    await page.getByRole('row', { name: new RegExp(ref) }).getByRole('link', { name: 'Open' }).click();
    await expect(page.getByTestId('amount-check')).toContainText('Within the verified bill');
    await expect(page.getByRole('button', { name: /prescription/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /pharmacy invoice/i }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: /Pantoprazole/ }).first()).toBeVisible();
    await expect(page.getByText(/confirmed by the claimant/).first()).toBeVisible();
    await expect(page.getByText(/medicine, strength and quantity match/i)).toBeVisible();
    await page.getByRole('button', { name: /pharmacy invoice/i }).first().click();
    await expect(page.getByRole('img', { name: /invoice/i })).toBeVisible();
    await page.context().close();
  });

  test('insurer asks the AI evidence assistant: cited answer from prescription and invoice; it will not decide', async ({ browser }) => {
    const page = await as(browser, REVIEWER);
    await page.goto('/payer/claims');
    await page.getByPlaceholder('Claim reference').fill(ref);
    await page.getByRole('row', { name: new RegExp(ref) }).getByRole('link', { name: 'Open' }).click();
    const panel = page.getByTestId('payer-assistant');
    await expect(panel.getByRole('heading', { name: 'Evidence Assistant' })).toBeVisible();
    await panel.getByRole('button', { name: 'Compare the prescription and the invoice' }).click();
    const first = panel.getByTestId('assistant-answer').first();
    await expect(first).toBeVisible();
    await expect(first).toContainText('40');
    await expect(first.getByTestId('assistant-source').filter({ hasText: /Prescription/i }).first()).toBeVisible();
    await expect(first.getByTestId('assistant-source').filter({ hasText: /Invoice/i }).first()).toBeVisible();
    // A citation opens the cited document.
    await first.getByTestId('assistant-source').filter({ hasText: /Invoice/i }).first().click();
    await expect(page.getByRole('img', { name: /invoice/i })).toBeVisible();
    await page.reload();

    await panel.getByLabel("Ask about this claim's evidence").fill('Should I approve this claim?');
    await panel.getByRole('button', { name: 'Ask' }).click();
    await expect(panel.getByTestId('assistant-answer').last()).toContainText('cannot approve, reject');
    await page.context().close();
  });

  test('insurer reviews and approves in full with a note', async ({ browser }) => {
    const page = await as(browser, REVIEWER);
    await page.goto('/payer/claims');
    await page.getByPlaceholder('Claim reference').fill(ref);
    await page.getByRole('row', { name: new RegExp(ref) }).getByRole('link', { name: 'Open' }).click();
    await page.getByRole('button', { name: 'Start Review' }).click();
    await expect(page.getByText('Under insurer review').first()).toBeVisible();
    await page.getByRole('button', { name: 'Approve', exact: true }).click();
    await page.getByLabel('Decision note (shared with claimant)').fill('Bill matches the verified prescription; covered under outpatient benefit.');
    await page.getByRole('button', { name: 'Record Decision' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Record Decision' }).click();
    await expect(page.getByText('Decision recorded').first()).toBeVisible();
    await page.context().close();
  });

  test('insurer admin marks it settled (simulated) and the claimant sees it', async ({ browser }) => {
    const admin = await as(browser, ADMIN);
    await admin.goto('/payer/claims');
    await admin.getByPlaceholder('Claim reference').fill(ref);
    await admin.getByRole('row', { name: new RegExp(ref) }).getByRole('link', { name: 'Open' }).click();
    await admin.getByRole('button', { name: 'Mark Settled (demo)' }).click();
    await expect(admin.getByText('Marked settled (simulated)')).toBeVisible();
    await admin.context().close();

    const page = await as(browser, CLAIMANT);
    await page.goto('/patient/claims');
    await page.getByRole('button', { name: new RegExp(ref) }).click();
    await expect(page.getByText(/simulated settlement/i)).toBeVisible();
    await expect(page.getByText(/Settled amount/)).toContainText('₹230');
    await page.context().close();
  });

  test('a settled bill cannot be claimed again, with any insurer', async ({ browser, request }) => {
    const page = await as(browser, CLAIMANT);
    await page.goto('/patient/claims');
    await page.getByRole('button', { name: 'New Claim' }).click();
    const option = page.locator('#claim-case option', { hasText: CASE_REF });
    await expect(option).toContainText('already claimed');
    await expect(option).toBeDisabled();
    // The seeded case 001 was settled in full earlier, so it is blocked too.
    await expect(page.locator('#claim-case option', { hasText: 'PV-DEMO-ANANYA-001' })).toBeDisabled();
    await page.context().close();

    const login = await request.post(`${API}/users/login`, { data: { email: CLAIMANT.email, password: DEMO_PASSWORD, role: 'patient' } });
    const auth = { Authorization: `Bearer ${(await login.json()).token}` };
    const cases = await (await request.get(`${API}/v1/claims/eligible-cases`, { headers: auth })).json();
    const demo = cases.find((c: { caseReference: string }) => c.caseReference === CASE_REF);
    expect([demo.claimable, demo.remainingAmount, demo.blockedCode]).toEqual([false, 0, 'CASE_FULLY_CLAIMED']);
    const payers = await (await request.get(`${API}/v1/claims/payers`, { headers: auth })).json();
    for (const payer of payers) {
      const res = await request.post(`${API}/v1/claims`, {
        headers: auth,
        data: { caseId: demo.id, payerOrganizationId: payer.id, claimedAmount: 10, policyNumber: 'SYN-POL-AGAIN', consent: { accepted: true } }
      });
      expect(res.status(), `re-claim with ${payer.name}`).toBe(409);
      expect(['ALREADY_DECIDED_BY_PAYER', 'CASE_FULLY_CLAIMED']).toContain((await res.json()).code);
    }
  });

  test('seeded history: the insurer queue already holds a settled demo claim', async ({ browser }) => {
    const page = await as(browser, REVIEWER);
    await page.goto('/payer/claims');
    await expect(page.getByRole('row', { name: /Settled/ }).first()).toBeVisible();
    await page.context().close();
  });
});
