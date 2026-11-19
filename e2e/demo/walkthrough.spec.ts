import { test, expect, Browser, Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { signIn } from '../tests/helpers';

const OUT = path.resolve(__dirname, '..', 'demo-out');
const CLAIMANT = { tab: 'patient' as const, email: 'ananya.verma@claimant.example' };
const REVIEWER = { tab: 'claims_reviewer' as const, staffRole: 'payer_reviewer', email: 'rohit.mehta@sahyog-health.example' };
const ADMIN = { tab: 'claims_reviewer' as const, staffRole: 'payer_admin', email: 'kavya.iyer@sahyog-health.example' };
const CASE_REF = 'PV-DEMO-ANANYA-002';
let shot = 0;
let scene = 0;

async function caption(page: Page, step: string, text: string) {
  await page.evaluate(([s, t]) => {
    let el = document.getElementById('pv-demo-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'pv-demo-caption';
      el.setAttribute('style', 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2147483647;pointer-events:none;'
        + 'background:rgba(27,42,94,.94);color:#fff;font:600 17px/1.35 Inter,Segoe UI,Arial,sans-serif;padding:12px 20px;border-radius:12px;'
        + 'box-shadow:0 6px 24px rgba(0,0,0,.25);max-width:1100px;text-align:center');
      document.body.appendChild(el);
    }
    el.innerHTML = `<span style="color:#F6C177;margin-right:10px">${s}</span>${t}`;
  }, [step, text]);
  await page.waitForTimeout(1600);
}

async function snap(page: Page, name: string) {
  shot += 1;
  await page.screenshot({ path: path.join(OUT, 'shots', `${String(shot).padStart(2, '0')}-${name}.png`) });
}

async function as(browser: Browser, who: { tab: 'patient' | 'claims_reviewer'; email: string; staffRole?: string }, title: string) {
  scene += 1;
  const context = await browser.newContext({ recordVideo: { dir: path.join(OUT, 'raw', String(scene).padStart(2, '0')), size: { width: 1440, height: 900 } }, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await signIn(page, who);
  await page.waitForURL(who.tab === 'patient' ? '**/patient/**' : '**/payer/**');
  await page.waitForLoadState('networkidle');
  await caption(page, `Scene ${scene}`, title);
  return page;
}

async function openClaim(page: Page, ref: string) {
  await page.goto('/payer/claims');
  await page.getByPlaceholder('Claim reference').fill(ref);
  await page.getByRole('row', { name: new RegExp(ref) }).getByRole('link', { name: 'Open' }).click();
  await page.waitForLoadState('networkidle');
}

test('PharmaVault live walkthrough: claimant → insurer + AI evidence assistant → settlement', async ({ browser }) => {
  fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
  let ref = '';

  // Scene 1: claimant
  let page = await as(browser, CLAIMANT, 'Claimant Ananya signs in (synthetic demo account)');
  await snap(page, 'claimant-dashboard');
  await page.goto('/patient/claims');
  await page.waitForLoadState('networkidle');
  await caption(page, '1 · Claims', 'Her claim history already shows one settled claim (simulated settlement)');
  await snap(page, 'claimant-claims');
  await page.getByRole('button', { name: 'New Claim' }).click();
  await caption(page, '1 · New claim', 'Only pharmacist-VERIFIED cases can be claimed; already-claimed bills are greyed out');
  const value = await page.locator('#claim-case option', { hasText: CASE_REF }).getAttribute('value');
  await page.getByLabel('Verified Case *').selectOption(value!);
  await expect(page.getByText(/Verified pharmacy bill/)).toContainText('230');
  await caption(page, '1 · Bill check', 'The verified pharmacy bill is ₹230 — the server refuses any claim above it');
  await page.getByLabel('Insurer *').selectOption({ label: 'Sahyog Health Assurance (Demo)' });
  await page.getByLabel('Claimed Amount (₹) *').fill('230');
  await page.getByLabel('Policy Number *').fill('SYN-POL-24018');
  await caption(page, '1 · Consent', 'Explicit, revocable consent creates a CaseShareGrant for this one insurer');
  await page.getByLabel('I agree to share this case with the selected insurer.').check();
  await snap(page, 'claimant-new-claim');
  await page.getByRole('button', { name: 'Submit Claim' }).click();
  const toast = page.getByText(/Claim CLM-.* submitted/);
  await expect(toast).toBeVisible();
  ref = ((await toast.textContent()) || '').match(/CLM-[A-Z0-9-]+/)?.[0] || '';
  await caption(page, '1 · Submitted', `Claim ${ref} sent to the insurer`);
  await snap(page, 'claimant-submitted');
  await page.context().close();

  // Scene 2: insurer reviewer
  page = await as(browser, REVIEWER, 'Insurer reviewer Rohit (separate payer tenant) opens his queue');
  await snap(page, 'insurer-dashboard');
  await openClaim(page, ref);
  await caption(page, '2 · Evidence', 'He sees only what the claimant shared: documents, OCR fields, checks, signals, pharmacist decision');
  await expect(page.getByTestId('amount-check')).toContainText('Within the verified bill');
  await snap(page, 'insurer-claim');
  await page.mouse.wheel(0, 700);
  await caption(page, '2 · Checks', 'Consistency checks and the pharmacist’s verified decision, with notes');
  await snap(page, 'insurer-checks');
  await page.mouse.wheel(0, -700);
  await page.getByRole('button', { name: /pharmacy invoice/i }).first().click();
  await expect(page.getByRole('img', { name: /invoice/i })).toBeVisible();
  await caption(page, '2 · Original document', 'The exact uploaded invoice (synthetic), served only through the active consent grant');
  await snap(page, 'insurer-invoice');
  await page.reload();
  await page.waitForLoadState('networkidle');

  const panel = page.getByTestId('payer-assistant');
  await panel.scrollIntoViewIfNeeded();
  await caption(page, '2 · AI Evidence Assistant', 'Local TrustRAG pipeline — no web search, no external AI — answers with citations');
  await panel.getByRole('button', { name: 'Compare the prescription and the invoice' }).click();
  await expect(panel.getByTestId('assistant-answer').first()).toBeVisible();
  await caption(page, '2 · Cited answer', 'Prescription vs invoice compared field by field; every fact cites its source');
  await snap(page, 'assistant-answer');
  await panel.getByLabel("Ask about this claim's evidence").fill('Should I approve this claim?');
  await panel.getByRole('button', { name: 'Ask' }).click();
  await expect(panel.getByTestId('assistant-answer').last()).toContainText('cannot approve, reject');
  await caption(page, '2 · Humans decide', 'Asked to decide, the AI refuses: approval is a human decision with a written note');
  await snap(page, 'assistant-refuses');

  await page.getByRole('button', { name: 'Start Review' }).click();
  await expect(page.getByText('Under insurer review').first()).toBeVisible();
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await page.getByLabel('Decision note (shared with claimant)').fill('Bill matches the verified prescription; covered under outpatient benefit.');
  await caption(page, '2 · Decision', 'Rohit approves with a note — the decision is audited');
  await page.getByRole('button', { name: 'Record Decision' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Record Decision' }).click();
  await expect(page.getByText('Decision recorded').first()).toBeVisible();
  await snap(page, 'insurer-decision');
  await page.context().close();

  // Scene 3: insurer admin
  page = await as(browser, ADMIN, 'Insurer admin Kavya marks the approved claim settled');
  await openClaim(page, ref);
  await page.getByRole('button', { name: 'Mark Settled (demo)' }).click();
  await expect(page.getByText('Marked settled (simulated)')).toBeVisible();
  await caption(page, '3 · Settlement', 'Simulated settlement of the approved ₹230 — no money moves in this prototype');
  await snap(page, 'admin-settled');
  await page.context().close();

  // Scene 4: claimant again
  page = await as(browser, CLAIMANT, 'Back to Ananya: the outcome reaches the claimant');
  await page.goto('/patient/claims');
  await page.getByRole('button', { name: new RegExp(ref) }).click();
  await expect(page.getByText(/Settled amount/)).toContainText('₹230');
  await caption(page, '4 · Outcome', 'Decision note, settled amount and settlement reference are visible to her');
  await snap(page, 'claimant-settled');
  await page.getByRole('button', { name: 'New Claim' }).click();
  await expect(page.locator('#claim-case option', { hasText: CASE_REF })).toContainText('already claimed');
  await caption(page, '4 · No double payment', 'The same bill can never be claimed again — with any insurer');
  await snap(page, 'claimant-no-double-claim');
  await page.context().close();
});
