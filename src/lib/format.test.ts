import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDate, formatDateTime, formatINR, formatNumber, localName, maskMobile, normalizeMobile, toDevanagariDigits } from "./format.ts";

test("Indian digit grouping", () => {
  assert.equal(formatNumber(1234567.891), "12,34,567.89");
  assert.equal(formatNumber(30), "30");
});

test("rupees", () => {
  assert.equal(formatINR(3000), "₹3,000");
  assert.equal(formatINR(123456.5), "₹1,23,456.50");
});

test("Marathi numerals", () => {
  assert.equal(toDevanagariDigits("2026-07-30"), "२०२६-०७-३०");
  assert.equal(formatNumber(1234567, { numerals: "deva" }), "१२,३४,५६७");
  assert.equal(formatINR(3000, { numerals: "deva" }), "₹३,०००");
});

test("dates are DD/MM/YYYY in India time", () => {
  // 20:00 UTC on 31 Jan is 01:30 on 1 Feb in Kolkata.
  assert.equal(formatDate(new Date("2026-01-31T20:00:00Z")), "01/02/2026");
  assert.equal(formatDateTime(new Date("2026-01-31T20:00:00Z")), "01/02/2026 01:30");
  assert.equal(formatDate("2026-07-15T06:00:00Z", { numerals: "deva" }), "१५/०७/२०२६");
});

test("bilingual names fall back to the other language", () => {
  assert.equal(localName({ nameMr: "गहू पीठ", nameEn: "Wheat flour" }, "mr"), "गहू पीठ");
  assert.equal(localName({ nameMr: "गहू पीठ", nameEn: "Wheat flour" }, "en"), "Wheat flour");
  assert.equal(localName({ nameMr: "गहू पीठ", nameEn: "" }, "en"), "गहू पीठ");
  assert.equal(localName({ nameMr: null, nameEn: "Rice" }, "mr"), "Rice");
});

test("mobile masking", () => {
  assert.equal(maskMobile("9876543210"), "98XXXXX210");
  assert.equal(maskMobile(null), "");
});

test("mobile numbers normalise to 10 digits", () => {
  assert.equal(normalizeMobile(9876543210), "9876543210");
  assert.equal(normalizeMobile("+91 98765 43210"), "9876543210");
  assert.equal(normalizeMobile("09876543210"), "9876543210");
  assert.equal(normalizeMobile("12345"), null);
  assert.equal(normalizeMobile("1234567890"), null);
  assert.equal(normalizeMobile(null), null);
});
