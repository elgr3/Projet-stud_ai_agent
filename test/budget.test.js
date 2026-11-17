import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_AMOUNT, addDays, forecast, isDate, localDate, parseAmount, sampleBudget } from '../budget.js';

const today = '2026-11-17';

function entry(id, type, amount, date, settled = false) {
  return { id, type, amount, date, settled };
}

test('parses French and decimal amounts without floating point conversion', () => {
  assert.equal(parseAmount(' 1\u202f234,56 '), 123456);
  assert.equal(parseAmount('2.5'), 250);
  assert.equal(parseAmount('0,01'), 1);
  assert.equal(parseAmount(0), 0);
  assert.equal(parseAmount('999999,99'), MAX_AMOUNT);
  for (const amount of ['', '1e2', '1 00', '1,001', '2,', '-1', '1.000,25', '1000000', null]) {
    assert.equal(parseAmount(amount), null, String(amount));
  }
});

test('checks calendar dates and shifts dates across month and year boundaries', () => {
  assert.equal(localDate(new Date(2026, 10, 17, 23, 59)), today);
  assert.equal(isDate('2024-02-29'), true);
  assert.equal(isDate('2026-02-29'), false);
  assert.equal(isDate('2026-2-09'), false);
  assert.equal(isDate('2026-02-09\n'), false);
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addDays('2027-01-01', -1), '2026-12-31');
  assert.throws(() => addDays('9999-12-31', 1), RangeError);
});

test('deducts the rent due before the next expected income', () => {
  const rent = entry('rent', 'bill', 18000, '2026-11-20');
  const bursary = entry('bursary', 'income', 37000, '2026-11-24');
  const result = forecast({ asOf: today, balance: 22000, entries: [rent, bursary] }, today);

  assert.equal(result.currentBalance, 22000);
  assert.equal(result.remaining, 4000);
  assert.equal(result.horizon, '2026-11-24');
  assert.equal(result.horizonDays, 7);
  assert.equal(result.weeklyGuide, 4000);
  assert.equal(result.nextIncome, bursary);
  assert.equal(result.firstShortfall, null);
});

test('applies settled history only from the opening balance date through today', () => {
  const entries = [
    entry('old', 'income', 99900, '2026-11-14', true),
    entry('salary', 'income', 5000, '2026-11-15', true),
    entry('shopping', 'expense', 1200, '2026-11-17', true),
    entry('future', 'bill', 49000, '2026-11-18', true),
  ];
  const result = forecast({ asOf: '2026-11-15', balance: 10000, entries }, today);
  assert.equal(result.currentBalance, 13800);
  assert.equal(result.remaining, 13800);
});

test('reserves overdue bills and excludes overdue unreceived income', () => {
  const bill = entry('overdue-rent', 'bill', 6000, '2026-11-16');
  const overdueIncome = entry('late-scholarship', 'income', 9000, '2026-11-15');
  const result = forecast({ asOf: today, balance: 5000, entries: [bill, overdueIncome] }, today);

  assert.deepEqual(result.overdueBills, [bill]);
  assert.deepEqual(result.overdueIncomes, [overdueIncome]);
  assert.equal(result.nextIncome, null);
  assert.equal(result.horizon, '2026-11-30');
  assert.equal(result.remainingRaw, -1000);
  assert.equal(result.remaining, 0);
  assert.deepEqual(result.firstShortfall, { date: today, balance: -1000, low: -1000 });
});

test('detects a shortfall before credit even when income is due the same day', () => {
  const sameDayBill = entry('bill', 'bill', 8000, today);
  const sameDayIncome = entry('income', 'income', 9000, today);
  const nextBill = entry('bill-next', 'bill', 17000, '2026-11-27');
  const result = forecast({ asOf: today, balance: 5000, entries: [sameDayIncome, nextBill, sameDayBill] }, today);

  assert.equal(result.nextIncome, sameDayIncome);
  assert.equal(result.horizonDays, 1);
  assert.equal(result.weeklyGuide, null);
  assert.equal(result.remainingRaw, -3000);
  assert.deepEqual(result.firstShortfall, { date: today, balance: 6000, low: -3000 });
  assert.equal(result.projectedLow, -11000);
});

test('includes the next income beyond month end and floors the weekly guide', () => {
  const rent = entry('rent', 'bill', 2001, '2026-12-01');
  const salary = entry('salary', 'income', 15000, '2026-12-02');
  const result = forecast({ asOf: today, balance: 5300, entries: [salary, rent] }, today);

  assert.equal(result.horizon, '2026-12-02');
  assert.equal(result.remaining, 3299);
  assert.equal(result.weeklyGuide, 1539);
  assert.equal(result.projection.length, 3);
  assert.deepEqual(result.projection.at(-1), { date: '2026-12-02', balance: 18299, low: 3299 });
});

test('uses the entire remainder of a leap month when there is no expected income', () => {
  const result = forecast({ asOf: '2024-02-23', balance: 8400, entries: [] }, '2024-02-23');

  assert.equal(result.horizon, '2024-02-29');
  assert.equal(result.horizonDays, 7);
  assert.equal(result.weeklyGuide, 8400);
});

test('the sample budget gives a realistic runway and can be recalculated without mutation', () => {
  const state = sampleBudget(today);
  const copy = structuredClone(state);
  const result = forecast(state, today);

  assert.equal(result.currentBalance, 43900);
  assert.equal(result.remaining, 12200);
  assert.equal(result.horizon, '2026-11-26');
  assert.deepEqual(state, copy);
});
