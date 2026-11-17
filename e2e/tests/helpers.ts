import { expect, Page, APIRequestContext } from '@playwright/test';

export const API = process.env.E2E_API_URL || 'http://127.0.0.1:5001/api';
export const DEMO_PASSWORD = 'password123';

/** Signs in through the real login page (cookie session, CSRF headers from the app). */
export async function signIn(page: Page, opts: { tab: 'patient' | 'pharmacy' | 'claims_reviewer'; email: string; staffRole?: string }) {
  const query = new URLSearchParams({ role: opts.tab, ...(opts.staffRole ? { staffRole: opts.staffRole } : {}) });
  await page.goto(`/login?${query.toString()}`);
  if (opts.staffRole) await page.getByLabel('Staff Role').selectOption(opts.staffRole);
  await page.getByPlaceholder('name@domain.com').fill(opts.email);
  await page.getByPlaceholder('••••••••').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: /^Sign In to/ }).click();
}

/**
 * Creates a VERIFIED case through the real API as test setup:
 * patient creates the case, the seeded pharmacist reviews it.
 * Document upload/OCR is covered by backend integration tests; here we only need an eligible case.
 */
export async function createVerifiedCaseViaApi(request: APIRequestContext): Promise<string> {
  const loginNative = async (email: string, role: string) => {
    const res = await request.post(`${API}/users/login`, { data: { email, password: DEMO_PASSWORD, role } });
    expect(res.ok(), `login ${email}`).toBeTruthy();
    return (await res.json()).token as string;
  };
  const patientToken = await loginNative('patient@test.com', 'patient');
  const created = await request.post(`${API}/v1/cases`, {
    headers: { Authorization: `Bearer ${patientToken}` },
    data: { subjectReference: `e2e-${Date.now()}` }
  });
  expect(created.ok()).toBeTruthy();
  const caseId = (await created.json()).id || (await created.json())._id;
  // Test-only shortcut, guarded server-side: see backend/scripts/e2eMarkCaseVerified.js
  const marked = await request.post(`${API}/v1/e2e/cases/${caseId}/mark-verified`, {
    headers: { 'X-E2E-Key': process.env.E2E_SETUP_KEY || 'local-e2e-only-key' }
  });
  expect(marked.ok(), 'E2E setup route must be enabled with E2E_SETUP_ENABLED=true (never in production)').toBeTruthy();
  return caseId;
}
