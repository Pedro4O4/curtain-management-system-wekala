/*
 * End-to-end API audit for the curtains shop.
 *
 * Usage:
 *   npm run qa:full
 *   TEST_API_URL=http://localhost:3001 npm run qa:full -- --strict
 *
 * The script always creates a brand-new QA user, so it never touches the
 * shop owner's account. The QA account is intentionally left intact so a
 * failed run can be inspected from the UI; its generated username is printed
 * at the end of the run.
 */

const apiUrl = (process.env.TEST_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const strict = process.argv.includes('--strict');
const tag = `qa${Date.now().toString(36)}`;
const username = `qa_${tag}`;
const password = 'QaIntegration2026!';
const dates = {
  d1: '2024-05-20',
  d2: '2024-05-21',
  d3: '2024-05-22',
  d4: '2024-05-23',
  month: '2024-05',
  future: '2099-01-01',
};

const passed = [];
const failed = [];
const auditGaps = [];

function display(value) {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function equal(actual, expected, message) {
  assert(actual === expected, `${message}: expected ${display(expected)}, received ${display(actual)}`);
}

function amount(actual, expected, message) {
  assert(Math.abs(Number(actual) - expected) < 0.000001, `${message}: expected ${expected}, received ${actual}`);
}

async function request(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }
  return { status: response.status, data };
}

async function ok(label, path, options = {}, expectedStatuses = [200, 201]) {
  const response = await request(path, options);
  if (!expectedStatuses.includes(response.status)) {
    const reason = typeof response.data === 'object' && response.data ? response.data.message : response.data;
    throw new Error(`${label} returned HTTP ${response.status}${reason ? ` (${display(reason)})` : ''}`);
  }
  return response.data;
}

async function check(label, callback) {
  try {
    await callback();
    passed.push(label);
    console.log(`✓ ${label}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failed.push({ label, message });
    console.log(`✗ ${label}\n  ${message}`);
  }
}

function audit(label, condition, details) {
  if (condition) {
    passed.push(label);
    console.log(`✓ ${label}`);
    return;
  }
  auditGaps.push({ label, details });
  console.log(`⚠ ${label}\n  ${details}`);
}

async function expectStatus(label, path, options, expectedStatus) {
  await check(label, async () => {
    const response = await request(path, options);
    equal(response.status, expectedStatus, `${label} status`);
  });
}

function productName(suffix) {
  return `${tag}-${suffix}`;
}

async function main() {
  console.log(`\nQA full-flow test against ${apiUrl}`);
  console.log(`Isolated account: ${username}\n`);

  const auth = await ok('register QA user', '/auth/register', {
    method: 'POST',
    body: { username, password },
  });
  const token = auth.token;
  assert(typeof token === 'string' && token.length > 20, 'Registration did not return a usable token');

  await check('authentication returns the new QA identity', async () => {
    const me = await ok('get current user', '/auth/me', { token });
    equal(me.user.id, auth.user.id, 'Authenticated user id');
    equal(me.user.username, username, 'Authenticated username');
  });

  const createProduct = (name, wholesalePrice) => ok(`create product ${name}`, '/products', {
    token,
    method: 'POST',
    body: { name, wholesalePrice },
  });

  const productA = await createProduct(productName('A'), 100);
  const productB = await createProduct(productName('B'), 50);
  const productC = await createProduct(productName('C'), 80);

  await check('product list contains the three sale products', async () => {
    const products = await ok('list products', '/products', { token });
    const names = products.map((product) => product.name);
    assert(names.includes(productA.name) && names.includes(productB.name) && names.includes(productC.name), 'Created products were not listed');
  });

  await check('creating a duplicate product returns the existing product', async () => {
    const duplicate = await createProduct(productA.name, 999);
    equal(duplicate._id, productA._id, 'Duplicate product id');
    amount(duplicate.wholesalePrice, 100, 'Duplicate product leaves original wholesale price unchanged');
  });

  const tempOne = await createProduct(productName('TEMP-ONE'), 10);
  const tempTwo = await createProduct(productName('TEMP-TWO'), 20);
  await check('single product edit updates name and price', async () => {
    const updated = await ok('edit temporary product', `/products/${tempOne._id}`, {
      token,
      method: 'PATCH',
      body: { name: productName('TEMP-EDITED'), wholesalePrice: 15 },
    });
    equal(updated.name, productName('TEMP-EDITED'), 'Edited product name');
    amount(updated.wholesalePrice, 15, 'Edited product wholesale price');
    tempOne._id = updated._id;
  });

  await check('bulk product price adjustment applies to every selected product', async () => {
    const changed = await ok('bulk adjust products', '/products/bulk-price', {
      token,
      method: 'PATCH',
      body: { productIds: [tempOne._id, tempTwo._id], adjustment: 5 },
    });
    amount(changed[0].wholesalePrice, 20, 'First bulk-adjusted price');
    amount(changed[1].wholesalePrice, 25, 'Second bulk-adjusted price');
  });

  await expectStatus('bulk price adjustment rejects a negative resulting price', '/products/bulk-price', {
    token,
    method: 'PATCH',
    body: { productIds: [tempOne._id], adjustment: -30 },
  }, 400);

  await check('single and bulk product deletion work', async () => {
    const deletedOne = await ok('delete one product', `/products/${tempOne._id}`, { token, method: 'DELETE' });
    equal(deletedOne.id, tempOne._id, 'Deleted product id');
    const deletedMany = await ok('delete bulk products', '/products/bulk', {
      token,
      method: 'DELETE',
      body: { productIds: [tempTwo._id] },
    });
    equal(deletedMany.deletedIds[0], tempTwo._id, 'Bulk deleted product id');
  });

  const retailOne = await ok('create partial retail receipt', `/records/day/${dates.d1}/sales/bulk`, {
    token,
    method: 'POST',
    body: {
      sales: [
        { item: productA.name, price: 150, meters: 2 },
        { item: productB.name, price: 80, meters: 3 },
      ],
      paidAmount: 300,
      paymentMethod: 'cash',
    },
  });
  const receiptOne = retailOne.createdReceipt;

  await check('partial retail receipt groups multiple items and snapshots product cost', async () => {
    amount(receiptOne.total, 540, 'Retail receipt total');
    amount(receiptOne.paidAmount, 300, 'Retail receipt paid now');
    amount(receiptOne.remainingAmount, 240, 'Retail receipt remaining');
    equal(receiptOne.paymentMethod, 'cash', 'Retail payment method');
    equal(receiptOne.items.length, 2, 'Retail receipt item count');
    amount(receiptOne.items[0].costPerMeter, 100, 'First snapshot cost per meter');
    amount(receiptOne.items[1].costPerMeter, 50, 'Second snapshot cost per meter');
  });
  audit(
    'new retail receipt response includes its computed profit',
    receiptOne.profit === 190,
    `The receipt response contains profit=${receiptOne.profit}; its day summary correctly computes 190 instead.`
  );

  const retailTwo = await ok('create full InstaPay retail receipt', `/records/day/${dates.d1}/sales/bulk`, {
    token,
    method: 'POST',
    body: {
      sales: [{ item: productA.name, price: 130, meters: 1 }],
      paidAmount: 130,
      paymentMethod: 'instapay',
    },
  });
  const retailThree = await ok('create full wallet retail receipt', `/records/day/${dates.d1}/sales/bulk`, {
    token,
    method: 'POST',
    body: {
      sales: [{ item: productB.name, price: 75, meters: 2 }],
      paidAmount: 150,
      paymentMethod: 'wallet',
    },
  });

  await check('retail receipt numbers are independent and sequential', async () => {
    equal(receiptOne.number + 1, retailTwo.createdReceipt.number, 'Second receipt number');
    equal(receiptOne.number + 2, retailThree.createdReceipt.number, 'Third receipt number');
  });

  let firstDay = await ok('get first retail day', `/records/day/${dates.d1}`, { token });
  await check('retail day totals before cash adjustments are correct', async () => {
    amount(firstDay.saleTotal, 580, 'Collected total');
    amount(firstDay.profitTotal, 270, 'Profit total');
    amount(firstDay.remainingTotal, 240, 'Remaining total');
    amount(firstDay.adjustmentTotal, 0, 'Cash adjustment total');
    amount(firstDay.dayTotal, 580, 'Day collection total');
    amount(firstDay.netTotal, 340, 'Current net formula');
  });

  await ok('add cash income', `/records/day/${dates.d1}/adjustments`, {
    token,
    method: 'POST',
    body: { amount: 100, reason: 'QA cash income', direction: '+' },
  });
  await ok('add cash expense', `/records/day/${dates.d1}/adjustments`, {
    token,
    method: 'POST',
    body: { amount: 25, reason: 'QA cash expense', direction: '-' },
  });
  firstDay = await ok('get adjusted retail day', `/records/day/${dates.d1}`, { token });

  await check('cash drawer increase and decrease are both reflected', async () => {
    amount(firstDay.adjustmentTotal, 75, 'Net cash adjustment');
    amount(firstDay.dayTotal, 655, 'Day total including cash drawer');
    amount(firstDay.netTotal, 415, 'Net total including unpaid amount');
    equal(firstDay.adjustments.length, 2, 'Cash adjustment count');
  });
  audit(
    'the label "net for the day" uses one calculation everywhere',
    firstDay.dayTotal === firstDay.netTotal,
    `The API returns dayTotal=${firstDay.dayTotal} and netTotal=${firstDay.netTotal}; the entry page labels dayTotal as "صافي اليوم" while home/details label netTotal that way.`
  );

  await expectStatus('retail rejects an unregistered curtain type', `/records/day/${dates.d3}/sales/bulk`, {
    token,
    method: 'POST',
    body: { sales: [{ item: productName('UNKNOWN'), price: 100, meters: 1 }] },
  }, 400);
  await expectStatus('retail rejects zero price', `/records/day/${dates.d3}/sales/bulk`, {
    token,
    method: 'POST',
    body: { sales: [{ item: productA.name, price: 0, meters: 1 }] },
  }, 400);
  await expectStatus('retail rejects zero meters', `/records/day/${dates.d3}/sales/bulk`, {
    token,
    method: 'POST',
    body: { sales: [{ item: productA.name, price: 100, meters: 0 }] },
  }, 400);
  await expectStatus('retail rejects a payment above the receipt total', `/records/day/${dates.d3}/sales/bulk`, {
    token,
    method: 'POST',
    body: { sales: [{ item: productA.name, price: 100, meters: 1 }], paidAmount: 101, paymentMethod: 'cash' },
  }, 400);
  await expectStatus('cash drawer rejects an empty reason', `/records/day/${dates.d3}/adjustments`, {
    token,
    method: 'POST',
    body: { amount: 1, reason: ' ', direction: '+' },
  }, 400);
  await expectStatus('cash drawer rejects an invalid direction', `/records/day/${dates.d3}/adjustments`, {
    token,
    method: 'POST',
    body: { amount: 1, reason: 'invalid direction', direction: 'x' },
  }, 400);
  await expectStatus('future retail day is locked for sales', `/records/day/${dates.future}/sales/bulk`, {
    token,
    method: 'POST',
    body: { sales: [{ item: productA.name, price: 100, meters: 1 }] },
  }, 403);

  const laterPayment = await ok('record the remaining retail payment on a later day', `/records/sales/${receiptOne.number}/payments`, {
    token,
    method: 'POST',
    body: { amount: 240, date: dates.d2, paymentMethod: 'instapay' },
  });
  await check('later retail payment settles the receipt', async () => {
    amount(laterPayment.paidAmount, 540, 'Settled receipt paid amount');
    amount(laterPayment.remainingAmount, 0, 'Settled receipt remaining amount');
    equal(laterPayment.payments.length, 2, 'Receipt payment count');
    equal(laterPayment.payments[1].date, dates.d2, 'Later payment date');
  });
  await expectStatus('fully paid retail receipt rejects another payment', `/records/sales/${receiptOne.number}/payments`, {
    token,
    method: 'POST',
    body: { amount: 1, date: dates.d2 },
  }, 400);

  const firstDayAfterLaterPayment = await ok('get original sale day after later payment', `/records/day/${dates.d1}`, { token });
  const laterPaymentDay = await ok('get later payment day before a sale is created', `/records/day/${dates.d2}`, { token });
  audit(
    'later retail payment is counted on the day it was collected',
    firstDayAfterLaterPayment.saleTotal === 580 && laterPaymentDay.saleTotal === 240,
    `Actual original-day collection=${firstDayAfterLaterPayment.saleTotal}; actual payment-day collection=${laterPaymentDay.saleTotal}.`
  );
  audit(
    'each retail installment preserves its payment method',
    laterPayment.payments[1]?.paymentMethod === 'instapay',
    'A later payment has a date and amount only; its cash / InstaPay / wallet method is not stored.'
  );

  const changedProductA = await ok('raise wholesale cost after historic receipts', `/products/${productA._id}`, {
    token,
    method: 'PATCH',
    body: { wholesalePrice: 125 },
  });
  await check('product price edit succeeds after sales exist', async () => {
    amount(changedProductA.wholesalePrice, 125, 'New wholesale cost');
  });

  const retailFour = await ok('create retail sale after cost edit', `/records/day/${dates.d2}/sales/bulk`, {
    token,
    method: 'POST',
    body: {
      sales: [{ item: productA.name, price: 160, meters: 1 }],
      paidAmount: 160,
      paymentMethod: 'wallet',
    },
  });
  await check('historic profit stays snapshotted while new profit uses the new cost', async () => {
    const sales = await ok('list retail sales', '/records/sales', { token });
    const historic = sales.sales.find((sale) => sale.number === receiptOne.number);
    const newer = sales.sales.find((sale) => sale.number === retailFour.createdReceipt.number);
    amount(historic.profit, 190, 'Historic receipt profit');
    amount(newer.profit, 35, 'New receipt profit');
    amount(sales.total, 980, 'All settled retail payments total');
    amount(sales.profitTotal, 305, 'All retail profit total');
  });

  const decimalProduct = await createProduct(productName('DECIMAL'), 30);
  const decimalSale = await ok('create decimal-meter retail sale', `/records/day/${dates.d4}/sales/bulk`, {
    token,
    method: 'POST',
    body: {
      sales: [{ item: decimalProduct.name, price: 100.5, meters: 1.5 }],
      paidAmount: 150.75,
      paymentMethod: 'cash',
    },
  });
  await check('decimal prices and meters calculate exactly in the API', async () => {
    amount(decimalSale.createdReceipt.total, 150.75, 'Decimal sale total');
    const decimalDay = await ok('get decimal sale day', `/records/day/${dates.d4}`, { token });
    const decimalReceipt = decimalDay.receipts.find((receipt) => receipt.number === decimalSale.createdReceipt.number);
    amount(decimalReceipt.profit, 105.75, 'Decimal sale profit');
  });

  const retroactiveReceipt = await ok('create unpaid receipt for payment validation', `/records/day/${dates.d4}/sales/bulk`, {
    token,
    method: 'POST',
    body: {
      sales: [{ item: productC.name, price: 90, meters: 1 }],
      paidAmount: 0,
      paymentMethod: 'cash',
    },
  });
  await expectStatus('retail rejects an installment above the remaining amount', `/records/sales/${retroactiveReceipt.createdReceipt.number}/payments`, {
    token,
    method: 'POST',
    body: { amount: 91, date: dates.d4 },
  }, 400);
  const retroactivePayment = await request(`/records/sales/${retroactiveReceipt.createdReceipt.number}/payments`, {
    token,
    method: 'POST',
    body: { amount: 10, date: dates.d3 },
  });
  audit(
    'retail rejects a payment dated before its sale',
    retroactivePayment.status === 400,
    `The API returned HTTP ${retroactivePayment.status} for a payment dated ${dates.d3} against a receipt created on ${dates.d4}.`
  );

  const createParty = (kind, suffix, phone) => ok(`create ${kind} party ${suffix}`, '/wholesale/parties', {
    token,
    method: 'POST',
    body: { kind, name: productName(suffix), phone },
  });
  const customerOne = await createParty('customer', 'CUSTOMER-ONE', '01000000001');
  const customerTwo = await createParty('customer', 'CUSTOMER-TWO', '01000000002');
  const supplierOne = await createParty('supplier', 'SUPPLIER-ONE', '01000000003');
  const supplierTwo = await createParty('supplier', 'SUPPLIER-TWO', '01000000004');

  await check('duplicate wholesale party returns the same isolated account', async () => {
    const duplicate = await ok('create duplicate customer party', '/wholesale/parties', {
      token,
      method: 'POST',
      body: { kind: 'customer', name: customerOne.name, phone: customerOne.phone },
    });
    equal(duplicate._id, customerOne._id, 'Duplicate party id');
  });

  const addWholesaleTransaction = (party, body) => ok(`wholesale ${body.type}`, `/wholesale/parties/${party._id}/transactions`, {
    token,
    method: 'POST',
    body,
  });

  await addWholesaleTransaction(customerOne, {
    date: dates.d1,
    type: 'sale_to_customer',
    items: [
      { item: productA.name, price: 150, meters: 4 },
      { item: productB.name, price: 120, meters: 3 },
    ],
    paidAmount: 360,
  });
  await addWholesaleTransaction(customerTwo, {
    date: dates.d1,
    type: 'sale_to_customer',
    items: [{ item: productC.name, price: 90, meters: 5 }],
    paidAmount: 450,
  });
  await addWholesaleTransaction(supplierOne, {
    date: dates.d1,
    type: 'purchase_from_supplier',
    items: [{ item: productA.name, price: 200, meters: 50 }],
    paidAmount: 5000,
  });
  await addWholesaleTransaction(supplierTwo, {
    date: dates.d1,
    type: 'purchase_from_supplier',
    items: [
      { item: productB.name, price: 100, meters: 10 },
      { item: productC.name, price: 50, meters: 4 },
    ],
    paidAmount: 200,
  });
  await addWholesaleTransaction(customerTwo, {
    date: dates.d2,
    type: 'sale_to_customer',
    items: [{ item: productA.name, price: 200, meters: 2 }],
    paidAmount: 100,
  });
  await addWholesaleTransaction(supplierOne, {
    date: dates.d2,
    type: 'sale_to_supplier',
    items: [{ item: productA.name, price: 500, meters: 10 }],
  });
  await addWholesaleTransaction(supplierTwo, { date: dates.d2, type: 'payment_to_supplier', amount: 300 });
  await addWholesaleTransaction(customerOne, { date: dates.d3, type: 'payment_from_customer', amount: 600 });
  await addWholesaleTransaction(customerTwo, { date: dates.d3, type: 'payment_from_customer', amount: 50 });
  await addWholesaleTransaction(supplierTwo, {
    date: dates.d3,
    type: 'sale_to_supplier',
    items: [{ item: productC.name, price: 90, meters: 10 }],
  });

  await check('four independent wholesale accounts have the expected balances', async () => {
    const [c1, c2, s1, s2] = await Promise.all([
      ok('get customer one account', `/wholesale/parties/${customerOne._id}/account`, { token }),
      ok('get customer two account', `/wholesale/parties/${customerTwo._id}/account`, { token }),
      ok('get supplier one account', `/wholesale/parties/${supplierOne._id}/account`, { token }),
      ok('get supplier two account', `/wholesale/parties/${supplierTwo._id}/account`, { token }),
    ]);
    amount(c1.balance, 0, 'Customer one settled balance');
    amount(c2.balance, 250, 'Customer two amount due');
    amount(s1.balance, 0, 'Supplier one offset balance');
    amount(s2.balance, -200, 'Supplier two credit balance');
    equal(c1.transactions.length, 2, 'Customer one transaction count');
    equal(s1.transactions.length, 2, 'Supplier one transaction count');
  });

  await check('customer and supplier lists keep balances separate', async () => {
    const customers = await ok('list wholesale customers', '/wholesale/parties?kind=customer', { token });
    const suppliers = await ok('list wholesale suppliers', '/wholesale/parties?kind=supplier', { token });
    amount(customers.find((party) => party._id === customerOne._id).balance, 0, 'Listed customer one balance');
    amount(customers.find((party) => party._id === customerTwo._id).balance, 250, 'Listed customer two balance');
    amount(suppliers.find((party) => party._id === supplierOne._id).balance, 0, 'Listed supplier one balance');
    amount(suppliers.find((party) => party._id === supplierTwo._id).balance, -200, 'Listed supplier two balance');
  });

  const history = await ok('get wholesale month history', `/wholesale/history?month=${dates.month}`, { token });
  await check('wholesale history totals, groups, and type totals are correct', async () => {
    equal(history.transactionCount, 10, 'Wholesale transaction count');
    equal(history.partyCount, 4, 'Wholesale party count');
    amount(history.total, 19860, 'Wholesale history total');
    amount(history.paidTotal, 7060, 'Wholesale history paid total');
    amount(history.balanceEffectTotal, 50, 'Wholesale history net balance effect');
    equal(history.days.length, 3, 'Wholesale day group count');
    equal(history.days[0].date, dates.d3, 'Newest wholesale history day');
    equal(history.byType.sale_to_customer.count, 3, 'Customer sale count');
    amount(history.byType.sale_to_customer.total, 1810, 'Customer sale total');
    amount(history.byType.purchase_from_supplier.total, 11200, 'Supplier purchase total');
    amount(history.byType.sale_to_supplier.total, 5900, 'Supplier offset total');
  });

  await check('wholesale history filters return the correct customer records', async () => {
    const customerHistory = await ok('get customer history', `/wholesale/history?kind=customer&month=${dates.month}`, { token });
    equal(customerHistory.transactionCount, 5, 'Customer history movement count');
    amount(customerHistory.total, 2460, 'Customer history total');
    amount(customerHistory.paidTotal, 1560, 'Customer history paid total');
    amount(customerHistory.balanceEffectTotal, 250, 'Customer history balance effect');
    const firstDay = await ok('get one wholesale day', `/wholesale/history?date=${dates.d1}`, { token });
    equal(firstDay.transactionCount, 4, 'First wholesale day count');
    amount(firstDay.total, 12610, 'First wholesale day total');
  });

  await expectStatus('wholesale history rejects day and month together', `/wholesale/history?date=${dates.d1}&month=${dates.month}`, { token }, 400);
  await expectStatus('customer account rejects supplier purchase transaction type', `/wholesale/parties/${customerOne._id}/transactions`, {
    token,
    method: 'POST',
    body: { date: dates.d3, type: 'purchase_from_supplier', items: [{ item: productA.name, price: 100, meters: 1 }], paidAmount: 0 },
  }, 400);
  await expectStatus('supplier account rejects customer sale transaction type', `/wholesale/parties/${supplierOne._id}/transactions`, {
    token,
    method: 'POST',
    body: { date: dates.d3, type: 'sale_to_customer', items: [{ item: productA.name, price: 100, meters: 1 }], paidAmount: 0 },
  }, 400);
  await expectStatus('wholesale rejects an unregistered product', `/wholesale/parties/${customerOne._id}/transactions`, {
    token,
    method: 'POST',
    body: { date: dates.d3, type: 'sale_to_customer', items: [{ item: productName('UNKNOWN-WHOLESALE'), price: 100, meters: 1 }], paidAmount: 0 },
  }, 400);
  await expectStatus('wholesale rejects a paid amount above the movement total', `/wholesale/parties/${customerOne._id}/transactions`, {
    token,
    method: 'POST',
    body: { date: dates.d3, type: 'sale_to_customer', items: [{ item: productA.name, price: 100, meters: 1 }], paidAmount: 101 },
  }, 400);
  await expectStatus('wholesale rejects a future transaction date', `/wholesale/parties/${customerOne._id}/transactions`, {
    token,
    method: 'POST',
    body: { date: dates.future, type: 'sale_to_customer', items: [{ item: productA.name, price: 100, meters: 1 }], paidAmount: 0 },
  }, 400);

  const attacker = await ok('register isolation probe user', '/auth/register', {
    method: 'POST',
    body: { username: `${username}_probe`, password },
  });
  await expectStatus('another user cannot access a wholesale account', `/wholesale/parties/${supplierOne._id}/account`, {
    token: attacker.token,
  }, 404);

  const craftedSupplierOffset = await ok('send crafted supplier offset with paidAmount', `/wholesale/parties/${supplierOne._id}/transactions`, {
    token,
    method: 'POST',
    body: {
      date: dates.d4,
      type: 'sale_to_supplier',
      items: [{ item: productB.name, price: 50, meters: 2 }],
      paidAmount: 50,
    },
  });
  audit(
    'supplier-offset movement cannot silently record a paid amount',
    craftedSupplierOffset.paidAmount === 0,
    `The API stored paidAmount=${craftedSupplierOffset.paidAmount} while it settled the full ${craftedSupplierOffset.balanceEffect} from the supplier account.`
  );

  const futureDay = await ok('read a future retail day', `/records/day/${dates.future}`, { token });
  await check('future retail day is read-only and locked', async () => {
    equal(futureDay.locked, true, 'Future day lock');
    amount(futureDay.saleTotal, 0, 'Future day collection');
  });

  console.log('\n────────────────────────────────────────');
  console.log(`Passed checks: ${passed.length}`);
  console.log(`Failed checks: ${failed.length}`);
  console.log(`Audit gaps: ${auditGaps.length}`);
  console.log(`QA account kept for inspection: ${username}`);
  console.log('────────────────────────────────────────');

  if (failed.length) {
    console.log('\nFailed checks:');
    for (const failure of failed) console.log(`- ${failure.label}: ${failure.message}`);
  }
  if (auditGaps.length) {
    console.log('\nLogic gaps detected:');
    for (const gap of auditGaps) console.log(`- ${gap.label}: ${gap.details}`);
  }

  if (failed.length || (strict && auditGaps.length)) process.exitCode = 1;
}

main().catch((error) => {
  console.error('\nQA suite could not complete.');
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
