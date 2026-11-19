import { test, expect, APIRequestContext } from '@playwright/test';
import { API, DEMO_PASSWORD, signIn } from './helpers';

/**
 * Patient 1 story: prescription -> order a prescription-only medicine from a nearby pharmacy ->
 * the pharmacist approves it in Pending Prescriptions -> the patient sees the decision.
 */
async function login(request: APIRequestContext, email: string, role: string) {
  const res = await request.post(`${API}/users/login`, { data: { email, password: DEMO_PASSWORD, role } });
  expect(res.ok(), `login ${email}`).toBeTruthy();
  return { Authorization: `Bearer ${(await res.json()).token}` };
}

test.describe.serial('Patient order with prescription -> pharmacy decision', () => {
  let orderId = '';
  let prescriptionId = '';

  test('server enforces price, stock and prescription rules', async ({ request }) => {
    const patient = await login(request, 'ananya.verma@claimant.example', 'patient');
    const nearby = await (await request.get(`${API}/pharmacy/nearby?medicine=Augmentin&lat=18.5204&lng=73.8567`, { headers: patient })).json();
    const hub = nearby.data.find((p: { prescriptionRequired: boolean }) => p.prescriptionRequired);
    expect(hub, 'a nearby pharmacy stocks the prescription-only medicine').toBeTruthy();

    const noRx = await request.post(`${API}/orders`, { headers: patient, data: { orderItems: [{ medicine: hub.medicineId, qty: 1 }] } });
    expect(noRx.status()).toBe(400);
    expect((await noRx.json()).message).toMatch(/prescription is required/i);

    const tooMany = await request.post(`${API}/orders`, { headers: patient, data: { orderItems: [{ medicine: hub.medicineId, qty: 100 }], prescriptionId: 'x' } });
    expect(tooMany.status()).toBeGreaterThanOrEqual(400);

    const prescriptions = await (await request.get(`${API}/prescriptions/my-prescriptions`, { headers: patient })).json();
    prescriptionId = prescriptions[0]._id;
    const placed = await request.post(`${API}/orders`, { headers: patient, data: { orderItems: [{ medicine: hub.medicineId, qty: 1, price: 1 }], totalPrice: 1, prescriptionId } });
    expect(placed.status(), JSON.stringify(await placed.json())).toBe(201);
    const order = (await placed.json()).orders[0];
    expect(order.status).toBe('Awaiting Pharmacist');
    expect(order.totalPrice).toBe(hub.medicinePrice);
    orderId = order._id;
  });

  test('pharmacist sees it in Pending Prescriptions and approves', async ({ page, request }) => {
    const pharmacy = await login(request, 'pharmacy@test.com', 'pharmacy');
    const queue = await (await request.get(`${API}/pharmacy/prescription-queue`, { headers: pharmacy })).json();
    const rx = queue.find((p: { _id: string }) => p._id === prescriptionId);
    expect(rx, 'prescription reached this pharmacy').toBeTruthy();

    await signIn(page, { tab: 'pharmacy', email: 'pharmacy@test.com' });
    await page.waitForURL('**/pharmacy/dashboard');
    await page.goto('/pharmacy/prescription-queue');
    await page.getByText('Ananya Verma').first().click();
    await page.getByRole('button', { name: 'Authorize & Approve' }).click();
    await expect(page.getByText(/Prescription marked as Approved/)).toBeVisible();
    await page.screenshot({ path: 'showcase/30-pharmacy-approved.png', fullPage: true });
  });

  test('patient sees the approved order', async ({ page, request }) => {
    const patient = await login(request, 'ananya.verma@claimant.example', 'patient');
    const orders = await (await request.get(`${API}/orders/myorders`, { headers: patient })).json();
    expect(orders.find((o: { _id: string }) => o._id === orderId).status).toBe('Approved');
    await signIn(page, { tab: 'patient', email: 'ananya.verma@claimant.example' });
    await page.waitForURL('**/patient/dashboard');
    await page.goto('/patient/orders');
    await expect(page.getByText('Approved').first()).toBeVisible();
    await page.screenshot({ path: 'showcase/31-patient-order-approved.png', fullPage: true });
  });
});
