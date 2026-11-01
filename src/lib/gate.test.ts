import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalPurpose, guessDonationType, parseGateRows, visitorKey } from "./gate.ts";

test("purposes: spelling and casing variants map to one code", () => {
  assert.equal(canonicalPurpose("School/Collage Visit"), "SCHOOL_COLLEGE");
  assert.equal(canonicalPurpose("school/Collage Visit"), "SCHOOL_COLLEGE");
  assert.equal(canonicalPurpose("Birthday Celebraytion"), "BIRTHDAY");
  assert.equal(canonicalPurpose("Birthday Celebration"), "BIRTHDAY");
  assert.equal(canonicalPurpose("Visit"), "VISIT");
  assert.equal(canonicalPurpose("visit"), "VISIT");
  assert.equal(canonicalPurpose("Accompany Visitor"), "ACCOMPANY");
  assert.equal(canonicalPurpose("Donation"), "DONATION");
  assert.equal(canonicalPurpose("Food Meal Donation"), "FOOD_MEAL");
  assert.equal(canonicalPurpose("Intersheep College"), "SCHOOL_COLLEGE");
  assert.equal(canonicalPurpose("Reletive"), "RELATIVE");
  assert.equal(canonicalPurpose("MSCB Meter Reading"), "MAINTENANCE");
  assert.equal(canonicalPurpose("Something new"), "OTHER");
  assert.equal(canonicalPurpose("  "), null);
});

test("donation types are guessed from the description", () => {
  assert.equal(guessDonationType("Jwari- 30 kg, Gahu- 30 kg"), "FOOD_GRAIN");
  assert.equal(guessDonationType("Old Cloths- 2 Bags"), "CLOTH");
  assert.equal(guessDonationType("Food Meal"), "MEAL");
  assert.equal(guessDonationType("Rs 5000 cash"), "CASH");
  assert.equal(guessDonationType("toys"), "OTHER");
});

const d = (s: string) => new Date(`${s}T00:00:00Z`);

test("parser: date rows set the day, visitor rows are cleaned and flagged", () => {
  const rows = [
    { n: 1, values: [null, "Sr No.", "Time", "Visitor Name", "Date of Birth", "Mobile No.", "Address", "REMARKS", "Extra Remark", "Visit No"] },
    { n: 2, values: [null, d("2026-01-01"), d("2026-01-01"), d("2026-01-01")] },
    { n: 3, values: [null, 1, null, "Ashok  Pandhare", d("1980-01-26"), 9673664455, "Pandharpur", "Visit"] },
    { n: 4, values: [null, 2, new Date("1899-12-30T10:30:00Z"), "Dharmnath", d("2026-01-01"), 79723, "", "school/Collage Visit", null, d("2026-02-18")] },
    { n: 5, values: [null, "7`", null, "Avinash", "19/09/2000", "9767930264", "Ashta", "", "", 3] },
    { n: 6, values: [null, null, null, "KBP Collage Student List"] },
    { n: 7, values: [null, null, null, "Pranav Kharat", d("2011-12-16"), 9011452114, "Kumbhej"] },
    { n: 8, values: [] },
  ];
  const r = parseGateRows(rows);
  assert.equal(r.stats.dayHeaders, 1);
  assert.equal(r.stats.visitRows, 4);
  assert.equal(r.stats.skippedNotes, 1);

  const [a, b, c, e] = r.visits;
  assert.deepEqual(
    { name: a.visitorName, dob: a.dob, mobile: a.mobile, purpose: a.purpose, date: a.date, flags: a.flags },
    { name: "Ashok Pandhare", dob: "1980-01-26", mobile: "9673664455", purpose: "VISIT", date: "2026-01-01", flags: [] },
  );
  assert.equal(b.time, "10:30");
  assert.equal(b.dob, null);
  assert.deepEqual(b.flags.sort(), ["BAD_MOBILE", "BAD_VISIT_NO", "DOB_IS_VISIT_DATE"]);
  assert.equal(b.purpose, "SCHOOL_COLLEGE");
  assert.equal(c.serialNo, 7);
  assert.equal(c.dob, "2000-09-19");
  assert.equal(c.visitNo, 3);
  assert.ok(c.flags.includes("SERIAL_CLEANED") && c.flags.includes("NO_PURPOSE"));
  assert.ok(e.flags.includes("NO_SERIAL"));
  assert.ok(r.issues.some((i) => i.row === 6 && i.code === "NOTE_ROW"));
});

test("parser: DOB placeholders are blank, impossible dates are flagged", () => {
  const row = (n: number, dob: unknown) => ({ n, values: [null, n, null, `P${n}`, dob, 9876543210, "X", "Visit"] });
  const farFuture = new Date(Date.UTC(26184, 8, 1)); // a corrupted cell seen in the real register
  const r = parseGateRows([{ n: 2, values: [null, d("2026-03-01")] }, row(3, "Not Provided"), row(4, "31/04/1962"), row(5, "01/01/1980`"), row(6, "-"), row(7, farFuture)]);
  assert.deepEqual(
    r.visits.map((v) => [v.dob, v.flags]),
    [
      [null, []],
      [null, ["DOB_UNREADABLE"]],
      ["1980-01-01", []],
      [null, []],
      [null, ["DOB_INVALID"]],
    ],
  );
});

test("parser: a corrupted day header becomes the day after the previous one, and is flagged", () => {
  const r = parseGateRows([
    { n: 2, values: [null, d("2026-09-15")] },
    { n: 3, values: [null, 1, null, "A", null, 9876543210, "X", "Visit"] },
    { n: 4, values: [null, new Date(Date.UTC(26184, 8, 1))] },
    { n: 5, values: [null, 1, null, "B", null, 9876543211, "X", "Visit"] },
  ]);
  assert.deepEqual(r.visits.map((v) => v.date), ["2026-09-15", "2026-09-16"]);
  assert.ok(r.issues.some((i) => i.row === 4 && i.code === "DATE_INFERRED" && i.detail === "2026-09-16"));
});

test("visitor key: same mobile + name is one person; family sharing a mobile stays separate", () => {
  assert.equal(visitorKey("Swati Bochare", "8421027083", "Karkamb"), visitorKey("swati  bochare", "8421027083", null));
  assert.notEqual(visitorKey("Swati Bochare", "8421027083", null), visitorKey("Rahul Bochare", "8421027083", null));
});
