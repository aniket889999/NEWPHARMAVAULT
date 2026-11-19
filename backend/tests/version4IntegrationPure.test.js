'use strict';
// Bounded integration checks with mocked model I/O. No database connection,
// private data, HTTP request, external model, payment or real order is used.
const test = require('node:test');
const assert = require('node:assert/strict');
const Medicine = require('../models/medicineModel');
const Prescription = require('../models/prescriptionModel');
const Order = require('../models/orderModel');
const { createOrder } = require('../controllers/orderController');
const parser = require('../services/localPrescriptionParser');
const ids = { patient: '650000000000000000000001', rx: '650000000000000000000002', a: '650000000000000000000003', b: '650000000000000000000004', orgA: '650000000000000000000005', orgB: '650000000000000000000006' };
const medicine = (overrides = {}) => ({ _id: ids.a, name: 'Synthetic inventory fixture', price: 12.5, stock: 10, prescriptionRequired: false, organizationId: ids.orgA, expiryDate: new Date('2099-01-01'), ...overrides });
function invoke(body) {
  return new Promise(resolve => {
    const res = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { resolve({ status: this.statusCode, body: value }); return this; } };
    createOrder({ body, user: { _id: ids.patient, role: 'patient' } }, res, error => resolve({ status: res.statusCode, error }));
  });
}
function modelFixtures(t, medicines) {
  const events = { filters: [], stock: [], orders: [], rxLookups: [], rxUpdates: [] };
  t.mock.method(Medicine, 'find', filter => { events.filters.push(filter); return { lean: async () => medicines }; });
  t.mock.method(Medicine, 'updateOne', async (filter, update) => { events.stock.push({ filter, update }); return { modifiedCount: 1 }; });
  t.mock.method(Prescription, 'findOne', async filter => { events.rxLookups.push(filter); return { _id: ids.rx }; });
  t.mock.method(Prescription, 'updateOne', async (filter, update) => { events.rxUpdates.push({ filter, update }); return { modifiedCount: 1 }; });
  t.mock.method(Order, 'create', async value => { const result = { _id: '6500000000000000000000' + String(10 + events.orders.length), ...value }; events.orders.push(result); return result; });
  return events;
}

test('v4 order quantities reject malformed, fractional and nonnumeric input before model I/O', async t => {
  const events = modelFixtures(t, [medicine()]);
  for (const qty of [1.5, '1.5', '2units', '1e2', true, null, [1], {}, 0, -1, 101]) {
    const result = await invoke({ orderItems: [{ medicine: ids.a, qty }] });
    assert.equal(result.status, 400, JSON.stringify(qty)); assert.ok(result.error);
  }
  assert.equal(events.filters.length, 0); assert.equal(events.stock.length, 0); assert.equal(events.orders.length, 0);
});

test('v4 duplicate rows cannot bypass the per-medicine quantity limit', async t => {
  const events = modelFixtures(t, [medicine()]);
  const result = await invoke({ orderItems: [{ medicine: ids.a, qty: 60 }, { medicine: ids.a, qty: 60 }] });
  assert.equal(result.status, 400); assert.equal(events.stock.length, 0); assert.equal(events.filters.length, 0);
});

test('v4 order totals use server prices and merge valid duplicate quantities', async t => {
  const events = modelFixtures(t, [medicine()]);
  const result = await invoke({ orderItems: [{ medicine: ids.a, qty: '1', price: 0.01 }, { medicine: ids.a, qty: 1 }], totalPrice: 0.01 });
  assert.equal(result.status, 201); assert.equal(events.orders.length, 1);
  assert.equal(events.orders[0].totalPrice, 25); assert.equal(events.orders[0].orderItems[0].qty, 2);
  assert.equal(events.orders[0].status, 'Pending'); assert.equal(events.orders[0].pharmacyOrganizationId, ids.orgA);
});

test('v4 available-stock lookup excludes recalled and expired inventory before reservation', async t => {
  const events = modelFixtures(t, []);
  const before = Date.now();
  const result = await invoke({ orderItems: [{ medicine: ids.a, qty: 1 }] });
  assert.equal(result.status, 400);
  assert.deepEqual(events.filters[0].recalled, { $ne: true });
  assert.ok(events.filters[0].expiryDate.$gt instanceof Date);
  assert.ok(events.filters[0].expiryDate.$gt.getTime() >= before);
  assert.equal(events.stock.length, 0); assert.equal(events.orders.length, 0);
});

test('v4 prescription-only orders require a prescription owned by the current patient', async t => {
  const events = modelFixtures(t, [medicine({ prescriptionRequired: true })]);
  t.mock.method(Prescription, 'findOne', async filter => { events.rxLookups.push(filter); return null; });
  const result = await invoke({ orderItems: [{ medicine: ids.a, qty: 1 }], prescriptionId: ids.rx });
  assert.equal(result.status, 400); assert.equal(result.error.code, 'PRESCRIPTION_REQUIRED');
  assert.deepEqual(events.rxLookups[0], { _id: ids.rx, user: ids.patient });
  assert.equal(events.stock.length, 0); assert.equal(events.orders.length, 0);
});

test('v4 an owned prescription enters pharmacy review, never automatic approval', async t => {
  const events = modelFixtures(t, [medicine({ prescriptionRequired: true })]);
  const result = await invoke({ orderItems: [{ medicine: ids.a, qty: 1 }], prescriptionId: ids.rx });
  assert.equal(result.status, 201); assert.equal(events.orders[0].status, 'Awaiting Pharmacist');
  assert.equal(events.orders[0].prescription, ids.rx);
  assert.equal(events.rxUpdates[0].update.$set.organizationId, ids.orgA);
  assert.equal(events.rxUpdates[0].update.$set.status, 'Pending Review');
});

test('v4 non-prescription inventory creates separate orders for separate pharmacies', async t => {
  const events = modelFixtures(t, [medicine(), medicine({ _id: ids.b, price: 7, organizationId: ids.orgB })]);
  const result = await invoke({ orderItems: [{ medicine: ids.a, qty: 1 }, { medicine: ids.b, qty: 2 }] });
  assert.equal(result.status, 201); assert.equal(events.orders.length, 2);
  assert.deepEqual(events.orders.map(value => [value.pharmacyOrganizationId, value.totalPrice]), [[ids.orgA, 12.5], [ids.orgB, 14]]);
});

test('v4 stock shortage returns the preceding reservation and creates no order', async t => {
  const events = modelFixtures(t, [medicine(), medicine({ _id: ids.b })]);
  t.mock.method(Medicine, 'updateOne', async (filter, update) => {
    events.stock.push({ filter, update });
    return { modifiedCount: events.stock.length === 2 ? 0 : 1 };
  });
  const result = await invoke({ orderItems: [{ medicine: ids.a, qty: 2 }, { medicine: ids.b, qty: 1 }] });
  assert.equal(result.status, 409); assert.equal(result.error.code, 'OUT_OF_STOCK'); assert.equal(events.orders.length, 0);
  assert.equal(events.stock.length, 3); assert.deepEqual(events.stock[2], { filter: { _id: ids.a }, update: { $inc: { stock: 2 } } });
});

test('v4 local printed-text parser extracts explicit fields and keeps no-read input empty', () => {
  const parsed = parser.parse('Patient: Synthetic Person\nDate: 18/11/2026\nTab. SyntheticAlpha 10mg 1-0-1 x 2 days after food\nCap. SyntheticBeta 20mg SOS');
  assert.equal(parsed.parser, 'local-rules'); assert.equal(parsed.medicines.length, 2);
  assert.equal(parsed.prescriptionDate, '2026-11-18'); assert.equal(parsed.medicines[0].dosage, '10 mg');
  assert.deepEqual(parsed.medicines[0].reminderTimes, ['08:00', '20:00']);
  assert.deepEqual(parsed.medicines[1].reminderTimes, []);
  assert.deepEqual(parser.parse('unreadable synthetic fixture').medicines, []);
});

test('v4 local prescription analysis does not initialize the external model with the flag disabled', async t => {
  const oldFlag = process.env.PRESCRIPTION_LLM_ENABLED;
  process.env.PRESCRIPTION_LLM_ENABLED = 'false';
  t.after(() => { if (oldFlag === undefined) delete process.env.PRESCRIPTION_LLM_ENABLED; else process.env.PRESCRIPTION_LLM_ENABLED = oldFlag; });
  t.mock.method(Medicine, 'find', () => ({ sort() { return this; }, limit() { return this; }, lean: async () => [] }));
  const result = await require('../services/prescriptionParserService').parse('Tab. SyntheticAlpha 10mg 1-0-1 x 2 days', 'data:image/png;base64,SYNTHETIC_UNUSED');
  assert.equal(result.parser, 'local-rules'); assert.equal(result.medicines.length, 1);
  assert.equal(result.medicines[0].matchType, 'Not in any pharmacy stock');
});
