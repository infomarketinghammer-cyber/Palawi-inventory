// Gate register: canonical visit purposes and the Excel parser. Pure (unit tested in gate.test.ts).
import { normalizeMobile } from "./format.ts";

export const PURPOSES = [
  "VISIT",
  "ACCOMPANY",
  "DONATION",
  "FOOD_MEAL",
  "SCHOOL_COLLEGE",
  "FIELD_WORK",
  "MAINTENANCE",
  "BIRTHDAY",
  "REGULAR",
  "REFERENCE",
  "MEET_COLLEAGUES",
  "JOB_INTERNSHIP",
  "SOCIAL_MEDIA",
  "CHILDREN_MEET",
  "RELATIVE",
  "PAYMENT",
  "ADMISSION",
  "MEDICAL",
  "OTHER_FOUNDATION",
  "MARRIAGE_ENQUIRY",
  "INTERVIEW",
  "BANK",
  "INSPECTION",
  "DELIVERY",
  "CELEBRATION",
  "OTHER",
] as const;
export type Purpose = (typeof PURPOSES)[number];

export const DONATION_TYPES = ["CLOTH", "FOOD_GRAIN", "MEAL", "CASH", "OTHER"] as const;
export type DonationType = (typeof DONATION_TYPES)[number];

// Ordered rules over the lower-cased, whitespace-collapsed remark. First match wins.
const PURPOSE_RULES: [RegExp, Purpose][] = [
  [/food meal|meal donation|annivars|anniversary meal|sahabhojan/, "FOOD_MEAL"],
  [/donat/, "DONATION"],
  [/accompan/, "ACCOMPANY"],
  [/school|coll?age|college/, "SCHOOL_COLLEGE"],
  [/intersh|internship|job/, "JOB_INTERNSHIP"],
  [/field ?work/, "FIELD_WORK"],
  [/maint|meter reading|mscb/, "MAINTENANCE"],
  [/birth ?day/, "BIRTHDAY"],
  [/regular/, "REGULAR"],
  [/admission/, "ADMISSION"],
  [/reference/, "REFERENCE"],
  [/colleague/, "MEET_COLLEAGUES"],
  [/social media|shooting|photograph/, "SOCIAL_MEDIA"],
  [/children meet/, "CHILDREN_MEET"],
  [/rel[ae]tive|parent'?s home/, "RELATIVE"],
  [/payment|check|cheque/, "PAYMENT"],
  [/medical/, "MEDICAL"],
  [/foundation/, "OTHER_FOUNDATION"],
  [/marriage/, "MARRIAGE_ENQUIRY"],
  [/interview/, "INTERVIEW"],
  [/bank/, "BANK"],
  [/inspection/, "INSPECTION"],
  [/courier|delivery|milk ?man/, "DELIVERY"],
  [/celebration|puraskar|science center|activity|guid/, "CELEBRATION"],
  [/^visit$|only visit/, "VISIT"],
];

/** Maps a free-text remark ("school/Collage Visit", "Birthday Celebraytion") to a canonical purpose. */
export function canonicalPurpose(raw: string | null | undefined): Purpose | null {
  const s = (raw ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!s) return null;
  // Common misspelling in the register.
  const fixed = s.replace("celebraytion", "celebration");
  for (const [re, p] of PURPOSE_RULES) if (re.test(fixed)) return p;
  return "OTHER";
}

/** Best guess of a donation's type from its description. */
export function guessDonationType(text: string | null | undefined): DonationType {
  const s = (text ?? "").toLowerCase();
  if (/cash|₹|\brs\.?\b|rupee|cheque|check|payment|online/.test(s)) return "CASH";
  if (/cloth|kapad|saree|dress/.test(s)) return "CLOTH";
  if (/meal|jevan|bhojan|lunch|dinner|nashta|breakfast/.test(s)) return "MEAL";
  if (/kg|gahu|wheat|tandul|rice|jwari|jowar|dal|oil|tel|sugar|sakhar|grain|dhanya|shengdane|shengadane|futane|biscuit|biskuit/.test(s))
    return "FOOD_GRAIN";
  return "OTHER";
}

export type ParsedVisit = {
  sourceRow: number;
  date: string; // YYYY-MM-DD
  serialNo: number | null;
  time: string | null;
  visitorName: string;
  dob: string | null; // YYYY-MM-DD
  mobile: string | null;
  address: string | null;
  purpose: Purpose | null;
  purposeRaw: string | null;
  extraRemark: string | null;
  visitNo: number | null;
  flags: string[];
};

export type ImportIssue = { row: number; code: string; detail: string };

export type ParseResult = {
  visits: ParsedVisit[];
  issues: ImportIssue[];
  stats: { dayHeaders: number; visitRows: number; skippedNotes: number; flaggedRows: number; donations: number };
};

type Cell = unknown;

/** Text of an exceljs cell value (plain, rich text, hyperlink or formula result). */
export function cellText(v: Cell): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    const o = v as { richText?: { text: string }[]; text?: string; result?: unknown };
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if (typeof o.text === "string") return o.text;
    if (o.result !== undefined) return cellText(o.result);
    return "";
  }
  return String(v);
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function parseTime(v: Cell): { time: string | null; bad: boolean } {
  if (v === null || v === undefined || v === "") return { time: null, bad: false };
  if (v instanceof Date) return { time: v.toISOString().slice(11, 16), bad: false };
  if (typeof v === "number" && v >= 0 && v < 1) {
    const mins = Math.round(v * 24 * 60);
    return { time: `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`, bad: false };
  }
  const s = cellText(v).trim();
  const m = s.match(/^(\d{1,2})[:.](\d{2})\s*(am|pm)?$/i);
  if (m) {
    let h = Number(m[1]);
    if (m[3]?.toLowerCase() === "pm" && h < 12) h += 12;
    if (m[3]?.toLowerCase() === "am" && h === 12) h = 0;
    if (h < 24) return { time: `${String(h).padStart(2, "0")}:${m[2]}`, bad: false };
  }
  return { time: null, bad: true };
}

function parseDob(v: Cell, visitDay: string): { dob: string | null; flag: string | null; raw: string } {
  const raw = cellText(v).trim();
  // Placeholders written in the register mean "not given", not bad data.
  if (!raw || /^(na|n\/a|-+|no|not provided|no birth date)$/i.test(raw)) return { dob: null, flag: null, raw };
  let d: Date | null = null;
  if (v instanceof Date) d = v;
  else {
    const m = raw.replace(/[^\d/.-]+$/, "").match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (m) {
      const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
      const candidate = new Date(Date.UTC(year, month - 1, day));
      // Reject impossible dates such as 31/04 instead of letting them roll over.
      if (candidate.getUTCDate() === day && candidate.getUTCMonth() === month - 1) d = candidate;
    }
  }
  if (!d || Number.isNaN(d.getTime())) return { dob: null, flag: "DOB_UNREADABLE", raw };
  const day = isoDay(d);
  if (day === visitDay) return { dob: null, flag: "DOB_IS_VISIT_DATE", raw };
  // Compare as dates, not strings: corrupted cells hold years like 26184 ("+026184-…" sorts before "2026-…").
  if (d.getUTCFullYear() < 1900 || d.getTime() > Date.parse(`${visitDay}T00:00:00Z`)) return { dob: null, flag: "DOB_INVALID", raw };
  return { dob: day, flag: null, raw };
}

/**
 * Parses the gate register sheet. `rows` are exceljs `row.values` arrays (1-based; index 0 unused),
 * including the header row. Date rows set the current day; numbered rows are visitors.
 */
export function parseGateRows(rows: { n: number; values: Cell[] }[]): ParseResult {
  const visits: ParsedVisit[] = [];
  const issues: ImportIssue[] = [];
  let day: string | null = null;
  let dayHeaders = 0;
  let skippedNotes = 0;

  for (const { n, values: v } of rows) {
    if (n === 1) continue; // header
    const first = v[1];
    if (first instanceof Date) {
      dayHeaders++;
      const y = first.getUTCFullYear();
      if (y >= 2000 && y <= 2100) day = isoDay(first);
      else if (day) {
        // Corrupted header (e.g. year 26184 between 15/09 and 17/09): assume the day after the previous one.
        day = isoDay(new Date(Date.parse(`${day}T00:00:00Z`) + 86400000));
        issues.push({ row: n, code: "DATE_INFERRED", detail: day });
      } else issues.push({ row: n, code: "NO_DATE", detail: cellText(first) });
      continue;
    }
    // Columns: 1 Sr No., 2 Time, 3 Visitor Name, 4 Date of Birth, 5 Mobile No., 6 Address, 7 REMARKS, 8 Extra Remark, 9 Visit No
    const name = cellText(v[3]).replace(/\s+/g, " ").trim();
    const dobCell = v[4];
    const mobileRaw = cellText(v[5]).trim();
    const address = cellText(v[6]).trim() || null;
    const purposeRaw = cellText(v[7]).trim() || null;
    const extra = cellText(v[8]).trim() || null;
    const serialRaw = cellText(first).trim();
    const hasPersonData = Boolean(mobileRaw || cellText(dobCell).trim() || address);

    if (!name && !serialRaw && !mobileRaw) {
      if (purposeRaw || extra) issues.push({ row: n, code: "NOTE_ROW", detail: [purposeRaw, extra].filter(Boolean).join(" / ") });
      continue; // blank row
    }
    if (!serialRaw && !hasPersonData && !purposeRaw) {
      skippedNotes++;
      issues.push({ row: n, code: "NOTE_ROW", detail: name });
      continue;
    }
    if (!day) {
      issues.push({ row: n, code: "NO_DATE", detail: name });
      continue;
    }

    const flags: string[] = [];
    let serialNo: number | null = null;
    if (serialRaw) {
      const digits = serialRaw.replace(/\D/g, "");
      serialNo = digits ? Number(digits) : null;
      if (digits !== serialRaw) flags.push("SERIAL_CLEANED");
    } else flags.push("NO_SERIAL");

    if (!name) flags.push("NO_NAME");
    const { time, bad: badTime } = parseTime(v[2]);
    if (badTime) flags.push("TIME_UNREADABLE");
    const { dob, flag: dobFlag } = parseDob(dobCell, day);
    if (dobFlag) flags.push(dobFlag);
    const mobile = normalizeMobile(mobileRaw);
    if (mobileRaw && !mobile) flags.push("BAD_MOBILE");

    let visitNo: number | null = null;
    const vn = v[9];
    if (vn !== null && vn !== undefined && cellText(vn).trim() !== "") {
      if (typeof vn === "number" && Number.isInteger(vn) && vn > 0 && vn < 1000) visitNo = vn;
      else flags.push("BAD_VISIT_NO");
    }
    const purpose = canonicalPurpose(purposeRaw);
    if (!purpose) flags.push("NO_PURPOSE");

    for (const f of flags) {
      if (f === "NO_PURPOSE" || f === "NO_SERIAL") continue;
      const raw = f.startsWith("DOB") ? cellText(dobCell) : f === "BAD_MOBILE" ? mobileRaw : f === "BAD_VISIT_NO" ? cellText(vn) : "";
      issues.push({ row: n, code: f, detail: raw ? `${name} — ${raw}` : name });
    }
    visits.push({
      sourceRow: n,
      date: day,
      serialNo,
      time,
      visitorName: name || "(unnamed)",
      dob,
      mobile,
      address,
      purpose,
      purposeRaw,
      extraRemark: extra,
      visitNo,
      flags,
    });
  }

  return {
    visits,
    issues,
    stats: {
      dayHeaders,
      visitRows: visits.length,
      skippedNotes,
      flaggedRows: visits.filter((x) => x.flags.some((f) => f !== "NO_PURPOSE" && f !== "NO_SERIAL")).length,
      donations: visits.filter((x) => x.purpose === "DONATION" || x.purpose === "FOOD_MEAL").length,
    },
  };
}

/** De-duplication key for visitor profiles: mobile + name, or name + address when there is no mobile. */
export function visitorKey(name: string, mobile: string | null, address: string | null): string {
  const n = name.toLowerCase().replace(/[^a-zऀ-ॿ]+/g, "");
  return mobile ? `m:${mobile}:${n}` : `n:${n}:${(address ?? "").toLowerCase().replace(/\s+/g, "")}`;
}
