import { test, expect } from '@playwright/test';
import { API, DEMO_PASSWORD, signIn } from './helpers';

/** Smart Reminders delivery, Nearby medicines (real inventory) and Authenticity check (ledger). */

test('authenticity check: registered batch is found, unknown batch is flagged', async ({ request }) => {
  const ok = await request.post(`${API}/blockchain/verify`, { data: { batch: 'B-DLO-650', manufacturer: 'Micro Labs Limited' } });
  expect(ok.ok()).toBeTruthy();
  expect((await ok.json()).status).toBe('verified');
  const fake = await request.post(`${API}/blockchain/verify`, { data: { batch: 'B-NOT-REAL-1', manufacturer: 'Nobody Pharma' } });
  expect((await fake.json()).status).toBe('suspicious');
});

test('authenticity check page shows the ledger result', async ({ page }) => {
  await signIn(page, { tab: 'patient', email: 'ananya.verma@claimant.example' });
  await page.waitForURL('**/patient/dashboard');
  await page.goto('/patient/authenticity');
  await expect(page.locator('body')).not.toContainText('Something went wrong');
});

test('nearby medicines lists real pharmacy stock, nearest first', async ({ page, request }) => {
  const res = await request.get(`${API}/pharmacy/nearby?medicine=Dolo&lat=12.9716&lng=77.5946`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const names = body.data.map((p: { name: string }) => p.name);
  expect(names).toContain('Shree Sai Medicals - Indiranagar');
  expect(names).toContain('CareWell Pharmacy - Koramangala');
  expect(body.data[0].distance).toBeLessThanOrEqual(body.data[body.data.length - 1].distance);
  expect(body.data.every((p: { medicineStock: number }) => p.medicineStock > 0)).toBeTruthy();

  await signIn(page, { tab: 'patient', email: 'ananya.verma@claimant.example' });
  await page.waitForURL('**/patient/dashboard');
  await page.goto('/patient/nearby-medicines?medicine=Dolo');
  await expect(page.getByText('Shree Sai Medicals - Indiranagar').first()).toBeVisible();
  await expect(page.getByText(/units available/).first()).toBeVisible();
  await page.screenshot({ path: 'showcase/20-nearby-medicines.png', fullPage: true });
});

test('smart reminder is delivered as a notification at its time', async ({ request }) => {
  test.setTimeout(150_000);
  const login = await request.post(`${API}/users/login`, { data: { email: 'ananya.verma@claimant.example', password: DEMO_PASSWORD, role: 'patient' } });
  const { token } = await login.json();
  const auth = { Authorization: `Bearer ${token}` };
  // A reminder due one minute ago (India time) is sent on the scheduler's next tick.
  const ist = new Date(Date.now() + 330 * 60_000 - 60_000);
  const hhmm = `${String(ist.getUTCHours()).padStart(2, '0')}:${String(ist.getUTCMinutes()).padStart(2, '0')}`;
  const created = await request.post(`${API}/reminders/create`, { headers: auth, data: { medicineName: 'Dolo 650mg Tablet', dosage: '1 tablet', reminderTime: hhmm, frequency: 'daily', email: 'ananya.verma@claimant.example' } });
  expect(created.ok()).toBeTruthy();
  await expect.poll(async () => {
    const list = await request.get(`${API}/v1/notifications`, { headers: auth });
    return ((await list.json()).items || []).some((n: { type: string }) => n.type === 'MEDICINE_REMINDER');
  }, { timeout: 120_000, intervals: [5_000] }).toBeTruthy();
});
