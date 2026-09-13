import assert from "node:assert/strict";
import { dodoCurrentPeriodEnd, parseDodoTimestamp } from "./dodo";

const iso = "2026-10-15T12:00:00.000Z";
const fromString = parseDodoTimestamp(iso);
assert.ok(fromString);
assert.equal(fromString.toISOString(), iso);

const fromDate = parseDodoTimestamp(new Date(iso));
assert.ok(fromDate);
assert.equal(fromDate.toISOString(), iso);

assert.equal(parseDodoTimestamp(""), null);
assert.equal(parseDodoTimestamp(undefined), null);
assert.equal(parseDodoTimestamp("not-a-date"), null);

const withField = dodoCurrentPeriodEnd({ next_billing_date: iso }, "monthly");
assert.equal(withField.toISOString(), iso);

const fromDateField = dodoCurrentPeriodEnd({ next_billing_date: new Date(iso) }, "annual");
assert.equal(fromDateField.toISOString(), iso);

const before = Date.now();
const inferredMonthly = dodoCurrentPeriodEnd({}, "monthly");
const after = Date.now();
const monthlyMs = 30 * 24 * 60 * 60 * 1000;
assert.ok(inferredMonthly.getTime() >= before + monthlyMs - 5);
assert.ok(inferredMonthly.getTime() <= after + monthlyMs + 5);

const inferredAnnual = dodoCurrentPeriodEnd({ next_billing_date: null }, "annual");
const annualMs = 365 * 24 * 60 * 60 * 1000;
assert.ok(inferredAnnual.getTime() >= before + annualMs - 5);
assert.ok(inferredAnnual.getTime() <= after + annualMs + 5);

console.log("dodo-period.test.ts ok");
