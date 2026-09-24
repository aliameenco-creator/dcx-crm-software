import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateCost, bookUsable } from '../src/lib/costing.ts';
const fixture = JSON.parse(readFileSync(new URL('./fixtures/cost-workbook.json', import.meta.url)));
const input = () => structuredClone(fixture.input);
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('matches the original XLS cached totals, including manual overrides', () => {
  const result = calculateCost(input()); assert.equal(result.valid, true);
  for (const [key, value] of Object.entries(fixture.expected)) close(result[key], value);
  close(result.sellingPrice, 363.6363636363636); close(result.totalCost, 200);
});
test('uses gross margin, not markup on cost', () => {
  const v = input(); v.lines[0].margin = .5; close(calculateCost(v).sellingPrice, 400);
});
test('manual cost stays independent of supplier cost and multiplier', () => {
  const v = input(); v.lines[0].supplierCost = 999; v.lines[0].multiplier = .01;
  close(calculateCost(v).totalCost, 200);
});
test('formula-driven mileage preserves fractional unit precision', () => {
  const v = input(); v.lines.forEach(l => l.quantity = 0); v.lines[3].quantity = 100;
  const r = calculateCost(v); close(r.totalCost, 54.12); close(r.sellingPrice, 66);
});
test('divides input currency but multiplies USD output', () => {
  const v = input(); v.lines[0].exchangeRate = .8; v.usdRate = .75;
  const r = calculateCost(v); close(r.totalCost, 250); close(r.usdSellingPrice, 250 / .55 * .75);
});
test('shipping and brokerage reduce profit without automatically changing selling price', () => {
  const v = input(); v.shipping = 50; v.brokerage = 25; const r = calculateCost(v);
  close(r.totalCost, 275); close(r.sellingPrice, fixture.expected.sellingPrice); close(r.profit, fixture.expected.profit - 75);
});
test('flat amounts reproduce workbook behavior and do not enter internal cost', () => {
  const v = input(); v.flatLines[0].amount = 100; v.flatLines[0].addition = 50;
  const r = calculateCost(v); close(r.sellingPrice, fixture.expected.sellingPrice + 150); close(r.totalCost, 200);
});
test('empty estimates have an undefined margin rather than division by zero', () => {
  const v = input(); v.lines.forEach(l => l.quantity = 0); const r = calculateCost(v);
  assert.equal(r.valid, true); assert.equal(r.grossMargin, null); close(r.sellingPrice, 0);
});
test('invalid exchange, margin, negative or nonfinite inputs cannot form a valid quote', () => {
  for (const [key, value] of [['exchangeRate', 0], ['margin', 1], ['margin', -.01], ['quantity', -1], ['manualCost', NaN], ['supplierCost', Infinity]]) {
    const v = input(); v.lines[0][key] = value; assert.equal(calculateCost(v).valid, false, key);
  }
});
test('optional tax is added only after pre-tax workbook calculation', () => {
  const v = input(); v.taxPercent = 13; const r = calculateCost(v); close(r.tax, 47.27); close(r.cadTotal, 410.91);
});
test('rate approval honors status and inclusive effective dates', () => {
  const b = { status: 'Published', effectiveFrom: '2026-09-01', effectiveTo: '2026-09-30' };
  assert.equal(bookUsable(b, '2026-09-16'), true); assert.equal(bookUsable(b, '2026-09-30'), true);
  assert.equal(bookUsable(b, '2026-10-01'), false); assert.equal(bookUsable({ ...b, status: 'Draft' }, '2026-09-16'), false);
});
