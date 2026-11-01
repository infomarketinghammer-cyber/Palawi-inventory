import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEntry } from "./entry-form.ts";

const today = "2026-10-31";

test("grain entry: child count and at least one quantity per line are required", () => {
  const r = parseEntry("grain", { date: "2026-10-30", lines: { 0: { itemId: "rice", inQty: "", outQty: "" } } }, "STORE_USER", today);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.errors.childCount, "required");
    assert.equal(r.errors["lines.0.inQty"], "entries.qtyRequired");
  }
  const ok = parseEntry("grain", { date: "2026-10-30", childCount: "30", lines: { 0: { itemId: "rice", inQty: "25", outQty: "4.5" }, 1: { itemId: "", inQty: "" } } }, "STORE_USER", today);
  assert.equal(ok.ok, true);
  if (ok.ok) assert.deepEqual([ok.data.lines.length, ok.data.lines[0].inQty, ok.data.lines[0].outQty, ok.data.childCount], [1, 25, 4.5, 30]);
});

test("future dates and duplicate items are rejected", () => {
  const r = parseEntry("vegetables", { date: "2026-11-01", childCount: "30", lines: { 0: { itemId: "a", qty: "1" }, 1: { itemId: "a", qty: "2" } } }, "STORE_USER", today);
  assert.equal(r.ok, false);
  if (!r.ok) assert.deepEqual([r.errors.date, r.errors.lines], ["entries.futureDate", "entries.duplicateItem"]);
});

test("same-day registers put qty in both in and out; fruit defaults to purchased", () => {
  const r = parseEntry("fruit", { date: today, childCount: "28", lines: { 0: { itemId: "banana", qty: "3" } } }, "STORE_USER", today);
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual([r.data.lines[0].inQty, r.data.lines[0].outQty, r.data.lines[0].source], [3, 3, "purchased"]);
});

test("kind registers route qty by kind and need a valid kind", () => {
  const r = parseEntry("utensils", { date: today, lines: { 0: { itemId: "plate", kind: "return", qty: "2" }, 1: { itemId: "cup", kind: "issue", qty: "5" } } }, "STORE_USER", today);
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.data.lines.map((l) => [l.inQty, l.outQty]), [[2, null], [null, 5]]);
  const bad = parseEntry("utensils", { date: today, lines: { 0: { itemId: "plate", kind: "purchase", qty: "2" } } }, "STORE_USER", today);
  assert.equal(bad.ok, false);
});

test("expenses: total is worked out from rate x headcount (haircut example)", () => {
  const r = parseEntry("expenses", { date: "2026-07-15", fields: { description: "Haircut", category: "SERVICE", perHeadRate: "100", headcount: "30" } }, "STORE_USER", today);
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.data.fields.total, 3000);
});

test("meals need at least one menu; admin-only fields are ignored for store users", () => {
  assert.equal(parseEntry("meals", { date: today, childCount: "30", fields: {} }, "STORE_USER", today).ok, false);
  const c = parseEntry("cleaning", { date: today, fields: { workerName: "Roshan", medicalOfficerName: "Dr X" }, lines: { 0: { itemId: "phenyl", qty: "2" } } }, "STORE_USER", today);
  assert.ok(c.ok);
  if (c.ok) assert.equal(c.data.fields.medicalOfficerName, undefined);
});
