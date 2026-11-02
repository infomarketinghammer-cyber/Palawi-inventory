// Adds sample records to every register so the app is easy to understand and demonstrate:
// at least 15 entries per register over the last ~3 weeks, plus sample gate visits and donations.
// Every sample record is marked "DEMO SAMPLE" (entry remarks, visit extra remark, donation description),
// stock balances stay consistent (all quantities go through the normal stock ledger), and
// `--remove` deletes exactly those records again.
//
// Run:    node scripts/demo-data.mts            (add)
//         node scripts/demo-data.mts --remove   (remove all sample records)
import { randomUUID } from "node:crypto";
import { PrismaClient, type Prisma } from "@prisma/client";
import { linesToMovements, type Line } from "../src/lib/stock.ts";
import type { ModuleKey } from "../src/lib/modules.ts";

try {
  process.loadEnvFile();
} catch {
  // .env is optional when variables come from the environment.
}

// Plain letters and a space only: Prisma sends startsWith to MongoDB as an unescaped regular expression.
const TAG = "DEMO SAMPLE";
const prisma = new PrismaClient();

const client = await prisma.client.findUniqueOrThrow({ where: { code: "PALAWI" } });
const institution = await prisma.institution.findFirstOrThrow({ where: { clientId: client.id, code: "PHP-PANDHARPUR" } });
const base = { clientId: client.id, institutionId: institution.id };

if (process.argv.includes("--remove")) {
  // Every candidate is re-checked in code and deleted by id, so a loose database match can never remove real records.
  const tagged = <T extends { id: string }>(rows: T[], text: (r: T) => string | null) => rows.filter((r) => text(r)?.startsWith(TAG)).map((r) => r.id);
  const ids = tagged(await prisma.entry.findMany({ where: { ...base, remarks: { startsWith: TAG } }, select: { id: true, remarks: true } }), (r) => r.remarks);
  const visitIds = tagged(await prisma.visit.findMany({ where: { ...base, extraRemark: { startsWith: TAG } }, select: { id: true, extraRemark: true } }), (r) => r.extraRemark);
  const donationIds = tagged(await prisma.donation.findMany({ where: { ...base, description: { startsWith: TAG } }, select: { id: true, description: true } }), (r) => r.description);
  const visitorIds = tagged(await prisma.visitor.findMany({ where: { ...base, key: { startsWith: "demo:" } }, select: { id: true, key: true } }), (r) => (r.key.startsWith("demo:") ? TAG : null));
  const m = await prisma.stockMovement.deleteMany({ where: { entryId: { in: ids } } });
  const a = await prisma.auditLog.deleteMany({ where: { clientId: client.id, reason: { equals: TAG } } });
  const d = await prisma.donation.deleteMany({ where: { id: { in: donationIds } } });
  const v = await prisma.visit.deleteMany({ where: { id: { in: visitIds } } });
  const vr = await prisma.visitor.deleteMany({ where: { id: { in: visitorIds } } });
  const e = await prisma.entry.deleteMany({ where: { id: { in: ids } } });
  console.log(`Removed ${e.count} entries, ${m.count} stock movements, ${v.count} visits, ${vr.count} visitors, ${d.count} donations, ${a.count} audit rows.`);
  await prisma.$disconnect();
  process.exit(0);
}

if (await prisma.entry.count({ where: { ...base, remarks: { startsWith: TAG } } })) {
  console.log("Sample records already exist. Run with --remove first to recreate them.");
  await prisma.$disconnect();
  process.exit(0);
}

const admin = await prisma.user.findFirstOrThrow({ where: { clientId: client.id, role: "ADMIN", active: true }, orderBy: { createdAt: "asc" } });
const store = await prisma.user.findFirstOrThrow({ where: { clientId: client.id, role: "STORE_USER", active: true }, orderBy: { createdAt: "asc" } });
const items = await prisma.item.findMany({ where: { clientId: client.id, active: true } });
const byCode = new Map(items.map((i) => [i.code, i]));
const id = (code: string) => {
  const i = byCode.get(code);
  if (!i) throw new Error(`Item ${code} not found`);
  return i.id;
};

// Days are counted back from today in India.
const todayIST = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
const day = (back: number) => new Date(new Date(`${todayIST}T00:00:00Z`).getTime() - back * 86400000);
const at = (back: number, hour: number) => new Date(day(back).getTime() + (hour - 5.5) * 3600000);
const pick = <T,>(list: readonly T[], i: number) => list[i % list.length];

const entries: Prisma.EntryCreateManyInput[] = [];
const moves: Prisma.StockMovementCreateManyInput[] = [];
const audits: Prisma.AuditLogCreateManyInput[] = [];
const balance = new Map<string, number>();

type DemoLine = Line & { rate?: number | null; amount?: number | null; donorName?: string | null; acknowledged?: boolean | null; note?: string | null; expiryDate?: Date | null };

/** One register entry with its stock movements. Approved unless `pending`. Refuses to let stock go negative. */
function add(module: ModuleKey, back: number, opts: { lines?: DemoLine[]; fields?: Record<string, unknown>; childCount?: number; remarks?: string; pending?: boolean; byAdmin?: boolean }) {
  const entryId = randomUUID();
  const status = opts.pending ? "PENDING" : "APPROVED";
  const author = opts.byAdmin ? admin : store;
  const created = at(back, 10 + (entries.length % 8));
  const lines = (opts.lines ?? []).map((l) => ({
    itemId: l.itemId ?? null,
    inQty: l.inQty ?? null,
    outQty: l.outQty ?? null,
    kind: l.kind ?? null,
    source: l.source ?? null,
    donorName: l.donorName ?? null,
    rate: l.rate ?? null,
    amount: l.rate != null ? Math.round(l.rate * (l.inQty ?? l.outQty ?? 0) * 100) / 100 : null,
    expiryDate: l.expiryDate ?? null,
    acknowledged: l.acknowledged ?? null,
    note: l.note ?? null,
  }));
  for (const m of linesToMovements(module, lines)) {
    const next = (balance.get(m.itemId) ?? 0) + (m.direction === "IN" ? m.qty : -m.qty);
    if (next < -1e-9) throw new Error(`Sample data would make ${m.itemId} negative in ${module} (${back} days ago)`);
    balance.set(m.itemId, next);
    moves.push({ ...base, itemId: m.itemId, qty: m.qty, direction: m.direction, type: m.type, module, entryId, date: day(back), status, createdAt: created });
  }
  entries.push({
    id: entryId,
    ...base,
    module,
    date: day(back),
    status,
    childCount: opts.childCount ?? null,
    fields: (opts.fields ?? {}) as Prisma.InputJsonValue,
    lines,
    remarks: `${TAG} ${opts.remarks ?? "नमुना नोंद / Sample record"}`,
    createdById: author.id,
    createdByName: author.name,
    ...(status === "APPROVED" ? { approvedById: admin.id, approvedByName: admin.name, approvedAt: at(back, 19) } : {}),
    createdAt: created,
  });
  audits.push({ clientId: client.id, institutionId: institution.id, userId: author.id, action: "create", entity: "Entry", entityId: entryId, newValue: { module }, reason: TAG, createdAt: created });
  if (status === "APPROVED") audits.push({ clientId: client.id, institutionId: institution.id, userId: admin.id, action: "approve", entity: "Entry", entityId: entryId, reason: TAG, createdAt: at(back, 19) });
}

const children = (back: number) => 28 + ((back * 7) % 6); // 28–33 children present

// ---- Stock in: opening stock, then purchases and donations ----------------------------------
const OPENING: Record<string, number> = {
  WHEAT: 80, WHEAT_FLOUR: 80, JOWAR: 50, JOWAR_FLOUR: 40, RICE: 100, RAVA: 15, POHA: 15,
  TUR_DAL: 30, MOONG_DAL: 15, CHANA_DAL: 15, MASOOR_DAL: 10, MATKI: 10, MOONG: 10, CHANA: 10, GROUNDNUT: 12,
  SUGAR: 40, JAGGERY: 15, SALT: 15, OIL: 45, JEERA: 3, MOHRI: 3, TURMERIC: 3, CHILLI_POWDER: 4, GODA_MASALA: 3,
  MILK: 0, GAS: 4,
  SHIRT: 60, SHORTS: 60, PANT: 50, VEST: 60, TOWEL: 50, FROCK: 30, SLIPPERS: 60, SHOES: 40, SOCKS: 80,
  BATH_SOAP: 120, TOOTHPASTE: 60, TOOTHBRUSH: 60, HAIR_OIL: 40, COMB: 40,
  PHENYL: 20, TOILET_CLEANER: 12, BLEACH: 15, DETERGENT: 30, DISHWASH: 40, BROOM: 15, MOP: 8, BUCKET: 10,
  PLATE: 80, BOWL: 80, GLASS: 80, CONTAINER: 30, BOX: 15, MATTRESS: 40, SATRANJI: 30, BEDSHEET: 80, BLANKET: 60, PILLOW: 45,
  PENCIL: 150, PEN: 150, NOTEBOOK: 200, ERASER: 80, SHARPENER: 80, SCHOOL_BAG: 40,
};
add("purchase", 21, {
  fields: { supplier: "प्रारंभिक साठा मोजणी / Opening stock count" },
  lines: Object.entries(OPENING).filter(([, q]) => q > 0).map(([code, q]) => ({ itemId: id(code), kind: "opening", inQty: q })),
  remarks: "महिन्याच्या सुरुवातीचा साठा / Opening stock",
  byAdmin: true,
});
const SUPPLIERS = ["विठ्ठल किराणा स्टोअर्स, पंढरपूर", "श्री गजानन ट्रेडर्स", "पंढरपूर कृषी उत्पन्न बाजार", "महालक्ष्मी सुपर मार्केट", "स्वामी समर्थ एजन्सी"];
const DONORS = ["श्री. सुरेश पाटील", "सौ. मीना कुलकर्णी", "रोटरी क्लब, पंढरपूर", "श्री. अमोल देशमुख", "लायन्स क्लब, सोलापूर", "श्री. राजेंद्र शिंदे"];
const PURCHASES: { back: number; lines: [string, number, number?][]; donation?: boolean }[] = [
  { back: 20, lines: [["RICE", 50, 42], ["TUR_DAL", 10, 125]] },
  { back: 19, lines: [["OIL", 15, 145], ["SUGAR", 20, 44]] },
  { back: 18, lines: [["WHEAT_FLOUR", 25], ["RICE", 25]], donation: true },
  { back: 17, lines: [["GAS", 2, 905]] },
  { back: 16, lines: [["MOONG_DAL", 10, 118], ["CHANA_DAL", 10, 92], ["GROUNDNUT", 5, 130]] },
  { back: 15, lines: [["BATH_SOAP", 48, 28], ["TOOTHPASTE", 24, 55]] },
  { back: 14, lines: [["JOWAR", 25], ["WHEAT", 25]], donation: true },
  { back: 12, lines: [["PHENYL", 10, 85], ["DETERGENT", 10, 95], ["DISHWASH", 20, 12]] },
  { back: 11, lines: [["NOTEBOOK", 100], ["PEN", 60], ["PENCIL", 60]], donation: true },
  { back: 10, lines: [["WHEAT_FLOUR", 30, 38], ["JOWAR_FLOUR", 15, 40]] },
  { back: 9, lines: [["TURMERIC", 1, 240], ["CHILLI_POWDER", 2, 280], ["GODA_MASALA", 1, 320], ["JEERA", 1, 360]] },
  { back: 8, lines: [["SLIPPERS", 30], ["TOWEL", 20]], donation: true },
  { back: 6, lines: [["RICE", 40, 44], ["SUGAR", 15, 44], ["SALT", 10, 22]] },
  { back: 5, lines: [["GAS", 2, 905], ["OIL", 10, 145]] },
  { back: 3, lines: [["BLANKET", 20], ["BEDSHEET", 20]], donation: true },
  { back: 1, lines: [["TUR_DAL", 15, 128], ["POHA", 10, 56], ["RAVA", 10, 48]] },
  { back: 0, lines: [["OIL", 15], ["RICE", 25]], donation: true },
];
PURCHASES.forEach((p, i) => {
  const donor = pick(DONORS, i);
  add("purchase", p.back, {
    fields: p.donation ? {} : { supplier: pick(SUPPLIERS, i), billNo: `B-${2400 + i * 7}` },
    lines: p.lines.map(([code, qty, rate]) => ({
      itemId: id(code),
      kind: p.donation ? "donation" : "purchase",
      inQty: qty,
      rate: p.donation ? null : rate ?? null,
      donorName: p.donation ? donor : null,
      expiryDate: ["OIL", "TUR_DAL", "MOONG_DAL", "POHA", "RAVA"].includes(code) ? day(p.back - 120) : null,
    })),
    remarks: p.donation ? `देणगी — ${donor} / Donated goods` : "खरेदी बिलाप्रमाणे / As per purchase bill",
    pending: p.back <= 1,
  });
});

// ---- Grain & provisions register: daily consumption for the whole home -----------------------
for (let back = 18; back >= 0; back--) {
  const lines: DemoLine[] = [
    { itemId: id("RICE"), outQty: 3.5 },
    { itemId: id(back % 2 ? "WHEAT_FLOUR" : "JOWAR_FLOUR"), outQty: 4 },
    { itemId: id(back % 3 ? "TUR_DAL" : "MOONG_DAL"), outQty: 1.2 },
    { itemId: id("OIL"), outQty: 0.9 },
    { itemId: id("SUGAR"), outQty: 0.8 },
    { itemId: id("SALT"), outQty: 0.25 },
    { itemId: id("MILK"), inQty: 8, outQty: 8 },
  ];
  if (back % 4 === 0) lines.push({ itemId: id("POHA"), outQty: 1.5 });
  if (back % 5 === 0) lines.push({ itemId: id("TURMERIC"), outQty: 0.1 }, { itemId: id("CHILLI_POWDER"), outQty: 0.15 });
  if (back % 6 === 0) lines.push({ itemId: id("GAS"), outQty: 1 });
  add("grain", back, { childCount: children(back), lines, remarks: "दैनंदिन वापर / Daily use", pending: back <= 1 });
}

// ---- Meals register: menus only ---------------------------------------------------------------
const BREAKFAST = ["पोहे, चहा / Poha, tea", "उपमा, दूध / Upma, milk", "शिरा, दूध / Sheera, milk", "इडली-चटणी / Idli-chutney", "थालीपीठ, दूध / Thalipeeth, milk"];
const LUNCH = ["पोळी, वरण-भात, बटाटा भाजी / Chapati, dal-rice, potato", "भाकरी, पिठले, भात / Bhakri, pithla, rice", "पोळी, मटकी उसळ, भात / Chapati, matki usal, rice", "पोळी, पालक डाळ, भात / Chapati, palak dal, rice", "मसाले भात, कढी / Masale bhat, kadhi"];
const SNACK = ["केळी / Banana", "शेंगदाणा लाडू / Groundnut laddoo", "चिवडा / Chivda", "फळे / Fruit", "बिस्किटे, दूध / Biscuits, milk"];
const DINNER = ["भाकरी, वांगी भाजी, वरण / Bhakri, brinjal, dal", "पोळी, कोबी भाजी, भात / Chapati, cabbage, rice", "खिचडी, कढी / Khichdi, kadhi", "पोळी, भेंडी भाजी, वरण-भात / Chapati, bhindi, dal-rice", "भाकरी, मेथी भाजी, आमटी / Bhakri, methi, amti"];
for (let back = 18; back >= 0; back--) {
  add("meals", back, {
    childCount: children(back),
    fields: { breakfast: pick(BREAKFAST, back), lunch: pick(LUNCH, back + 1), snack: pick(SNACK, back + 2), dinner: pick(DINNER, back + 3) },
    remarks: "आजचा आहार / Today's menu",
    pending: back <= 1,
  });
}

// ---- Vegetables and fruit: bought and used the same day ---------------------------------------
const VEG = ["PALAK", "METHI", "BRINJAL", "TOMATO", "CAULIFLOWER", "CABBAGE", "BHINDI", "DUDHI", "POTATO", "ONION", "CARROT", "GARLIC", "GINGER", "GREEN_CHILLI", "KOTHIMBIR"];
for (let back = 17; back >= 0; back--) {
  add("vegetables", back, {
    childCount: children(back),
    lines: [
      { itemId: id(pick(VEG, back)), outQty: 3 },
      { itemId: id(pick(VEG, back + 5)), outQty: 2.5 },
      { itemId: id("ONION"), outQty: 2 },
      { itemId: id(pick(["TOMATO", "POTATO"], back)), outQty: 2 },
      { itemId: id(pick(["KOTHIMBIR", "GREEN_CHILLI", "GINGER"], back)), outQty: 0.25 },
    ].filter((l, i, all) => all.findIndex((x) => x.itemId === l.itemId) === i),
    remarks: "भाजी मंडईतून खरेदी / Bought at the vegetable market",
    pending: back <= 1,
  });
}
const FRUIT = ["BANANA", "APPLE", "POMEGRANATE", "CHIKOO", "CUSTARD_APPLE", "GUAVA", "ORANGE"];
for (let back = 17; back >= 1; back--) {
  const donated = back % 3 === 0;
  const code = pick(FRUIT, back);
  add("fruit", back, {
    childCount: children(back),
    lines: [{ itemId: id(code), outQty: code === "BANANA" ? 4 : 5, source: donated ? "donated" : "purchased", donorName: donated ? pick(DONORS, back) : null }],
    remarks: donated ? "देणगीतून मिळालेली फळे / Donated fruit" : "मुलांसाठी फळे / Fruit for the children",
    pending: back <= 1,
  });
}

// ---- Monthly personal items: issued by item and quantity (no child records) -------------------
const PERSONAL: [string, number, string][] = [
  ["BATH_SOAP", 30, "महिन्याचा साबण / Monthly soap"], ["TOOTHPASTE", 15, "दोन मुलांना एक / One per two children"], ["TOOTHBRUSH", 30, "नवीन ब्रश / New brushes"],
  ["SHIRT", 10, "शाळेचा गणवेश / School uniform"], ["SHORTS", 10, "शाळेचा गणवेश / School uniform"], ["SLIPPERS", 12, "फाटलेल्या बदली / Replacing worn ones"],
  ["TOWEL", 10, ""], ["HAIR_OIL", 8, ""], ["COMB", 10, ""], ["SOCKS", 20, "शाळेसाठी / For school"], ["VEST", 15, ""],
  ["FROCK", 6, "मुलींसाठी / For girls"], ["SHOES", 8, "शाळेचे बूट / School shoes"], ["PANT", 8, ""], ["BATH_SOAP", 28, ""], ["TOOTHPASTE", 12, ""],
];
PERSONAL.forEach(([code, qty, note], i) => {
  const back = 15 - i;
  add("personal", back, {
    childCount: children(back),
    lines: [{ itemId: id(code), outQty: qty, acknowledged: back > 1, note: note || null }],
    remarks: "मुलांना वाटप / Issued to children",
    pending: back <= 1,
  });
});

// ---- Cleaning supplies: issued to a named worker ----------------------------------------------
const WORKERS = ["सुनीता जाधव", "रमेश पवार", "लता गायकवाड", "संगीता माने"];
const CLEAN: [string, number][][] = [
  [["PHENYL", 1], ["BROOM", 1]], [["TOILET_CLEANER", 1]], [["DETERGENT", 2], ["DISHWASH", 3]], [["BLEACH", 1]], [["PHENYL", 1], ["MOP", 1]],
  [["DISHWASH", 3]], [["DETERGENT", 2]], [["PHENYL", 1], ["TOILET_CLEANER", 0.5]], [["BUCKET", 1]], [["BLEACH", 0.5], ["BROOM", 1]],
  [["DISHWASH", 4]], [["DETERGENT", 2], ["PHENYL", 1]], [["TOILET_CLEANER", 1]], [["MOP", 1], ["BLEACH", 0.5]], [["PHENYL", 1.5]], [["DISHWASH", 3], ["DETERGENT", 1]],
];
CLEAN.forEach((lines, i) => {
  const back = 15 - i;
  const checked = back > 2 && i % 2 === 0;
  add("cleaning", back, {
    fields: { workerName: pick(WORKERS, i), ...(checked ? { medicalOfficerName: "डॉ. अनिल भोसले", medicalOfficerDate: day(back).toISOString().slice(0, 10) } : {}) },
    lines: lines.map(([code, q]) => ({ itemId: id(code), outQty: q })),
    remarks: "स्वच्छतेसाठी दिले / Issued for cleaning",
    pending: back <= 1,
  });
});

// ---- Utensils, bedding and stationery: issue, return, damage, loss ---------------------------
const UTENSILS: [string, string, number, string, string][] = [
  ["issue", "PLATE", 10, "स्वयंपाकघर / Kitchen", ""], ["issue", "BOWL", 10, "स्वयंपाकघर / Kitchen", ""], ["issue", "NOTEBOOK", 40, "शाळकरी मुले / School children", "सहामाही / Term start"],
  ["issue", "PEN", 30, "शाळकरी मुले / School children", ""], ["return", "PLATE", 4, "स्वयंपाकघर / Kitchen", "सहलीनंतर परत / Back after picnic"], ["damage", "GLASS", 3, "भोजन कक्ष / Dining hall", "फुटले / Broken"],
  ["issue", "BLANKET", 15, "मुलांची खोली १ / Dormitory 1", "हिवाळा / Winter"], ["issue", "BEDSHEET", 15, "मुलांची खोली १ / Dormitory 1", ""], ["issue", "MATTRESS", 4, "मुलांची खोली २ / Dormitory 2", ""],
  ["loss", "SCHOOL_BAG", 1, "शाळकरी मुले / School children", "हरवली / Lost"], ["issue", "PENCIL", 30, "अभ्यासिका / Study room", ""], ["issue", "ERASER", 20, "अभ्यासिका / Study room", ""],
  ["return", "BLANKET", 2, "मुलांची खोली २ / Dormitory 2", ""], ["issue", "CONTAINER", 5, "स्वयंपाकघर / Kitchen", ""], ["damage", "PLATE", 2, "स्वयंपाकघर / Kitchen", "वाकले / Bent"],
  ["issue", "PILLOW", 10, "मुलांची खोली २ / Dormitory 2", ""],
];
UTENSILS.forEach(([kind, code, qty, to, note], i) => {
  const back = 15 - i;
  const isIn = kind === "return";
  add("utensils", back, {
    fields: { issuedTo: to },
    lines: [{ itemId: id(code), kind, ...(isIn ? { inQty: qty } : { outQty: qty }), note: note || null }],
    remarks: "वस्तू नोंद / Item movement",
    pending: back <= 1,
  });
});

// ---- Expenses -----------------------------------------------------------------------------------
const EXPENSES: [string, string, number, number?, number?][] = [
  ["वीज बिल / Electricity bill", "UTILITY", 4860], ["पाणी टँकर / Water tanker", "UTILITY", 1200], ["डॉक्टर तपासणी / Doctor check-up", "MEDICAL", 1500],
  ["औषधे / Medicines", "MEDICAL", 2350], ["पिठाची गिरणी — दळण / Flour mill grinding", "SERVICE", 640, 4, 160], ["केस कापणे / Haircuts", "SERVICE", 1500, 50, 30],
  ["नळ दुरुस्ती / Plumbing repair", "MAINTENANCE", 950], ["रंगकाम साहित्य / Paint material", "MAINTENANCE", 3200], ["शाळा सहल बस / School trip bus", "OTHER", 4500],
  ["गॅस शेगडी दुरुस्ती / Gas stove repair", "MAINTENANCE", 450], ["इंटरनेट बिल / Internet bill", "UTILITY", 699], ["कपडे शिलाई / Tailoring", "SERVICE", 1800, 30, 60],
  ["प्रथमोपचार पेटी / First-aid kit", "MEDICAL", 780], ["झेरॉक्स / Photocopies", "OTHER", 320], ["फळे — स्थानिक बाजार / Fruit — local market", "PURCHASE", 1150], ["दिवाळी फराळ साहित्य / Diwali snacks material", "PURCHASE", 3600],
];
EXPENSES.forEach(([description, category, total, headcount, perHeadRate], i) => {
  const back = 15 - i;
  add("expenses", back, {
    fields: { description, category, total, ...(headcount ? { headcount, perHeadRate } : {}), paidBy: pick(["रोख / Cash", "UPI", "बँक / Bank"], i), billNo: `E-${510 + i}` },
    remarks: "खर्च नोंद / Expense",
    pending: back <= 1,
  });
});

// ---- Stock adjustments (admin only): month-end physical count corrections ---------------------
const ADJUST: [string, string, number, string][] = [
  ["adjust_out", "RICE", 1.5, "उंदरांमुळे नुकसान / Damaged by rats"], ["adjust_out", "SUGAR", 0.5, "मुंग्या लागल्या / Ant-infested"], ["adjust_in", "SALT", 1, "मोजणीत जास्त आढळले / Extra found in count"],
  ["adjust_out", "OIL", 0.5, "गळती / Leakage"], ["adjust_out", "WHEAT_FLOUR", 1, "ओलसर झाले / Got damp"], ["adjust_in", "DISHWASH", 2, "मोजणीत जास्त आढळले / Extra found in count"],
  ["adjust_out", "POHA", 0.5, "मुदत संपली / Expired"], ["adjust_out", "BATH_SOAP", 2, "मोजणीत कमी / Short in count"], ["adjust_in", "NOTEBOOK", 5, "जुना साठा सापडला / Old stock found"],
  ["adjust_out", "JOWAR", 1, "कीड लागली / Pest damage"], ["adjust_out", "GLASS", 2, "फुटलेले काढले / Broken removed"], ["adjust_in", "TOWEL", 2, "धुलाईतून परत / Back from laundry"],
  ["adjust_out", "MOONG_DAL", 0.5, "कीड लागली / Pest damage"], ["adjust_out", "DETERGENT", 0.5, "ओलसर झाले / Got damp"], ["adjust_in", "PEN", 4, "मोजणीत जास्त आढळले / Extra found in count"],
  ["adjust_out", "GROUNDNUT", 0.5, "खराब झाले / Spoiled"],
];
ADJUST.forEach(([kind, code, qty, reason], i) => {
  const back = 15 - i;
  add("adjustment", back, {
    fields: { reason },
    lines: [{ itemId: id(code), kind, ...(kind === "adjust_in" ? { inQty: qty } : { outQty: qty }) }],
    remarks: "प्रत्यक्ष मोजणीनुसार / As per physical count",
    pending: back <= 1,
    byAdmin: true,
  });
});

// ---- Gate register: visits, some with donations ------------------------------------------------
const VISITORS: [string, string, string, string, string?, number?][] = [
  ["अजय कदम", "9822011101", "पंढरपूर", "VISIT"], ["सौ. स्वाती जोशी", "9822011102", "सोलापूर", "BIRTHDAY"], ["के.बी.पी. महाविद्यालय विद्यार्थी", "9822011103", "पंढरपूर", "SCHOOL_COLLEGE"],
  ["श्री. सुरेश पाटील", "9822011104", "पंढरपूर", "DONATION", "CASH", 5000], ["सौ. मीना कुलकर्णी", "9822011105", "पुणे", "DONATION", "CLOTH"], ["महेश गवळी", "9822011106", "करकंब", "MAINTENANCE"],
  ["रोटरी क्लब, पंढरपूर", "9822011107", "पंढरपूर", "FOOD_MEAL", "MEAL"], ["प्रिया देशपांडे", "9822011108", "सांगोला", "VISIT"], ["श्री. अमोल देशमुख", "9822011109", "मंगळवेढा", "DONATION", "CASH", 2100],
  ["विनायक माळी", "9822011110", "पंढरपूर", "RELATIVE"], ["लायन्स क्लब, सोलापूर", "9822011111", "सोलापूर", "DONATION", "FOOD_GRAIN"], ["सौ. अर्चना शिंदे", "9822011112", "बार्शी", "BIRTHDAY"],
  ["राहुल बोचरे", "9822011113", "करकंब", "VISIT"], ["श्री. राजेंद्र शिंदे", "9822011114", "पंढरपूर", "DONATION", "CASH", 1100], ["स्नेहा पवार", "9822011115", "अकलूज", "ACCOMPANY"],
  ["दत्तात्रय लोंढे", "9822011116", "पंढरपूर", "VISIT"],
];
const counterName = (d: Date) => {
  const y = d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return { fy: `${y}-${String((y + 1) % 100).padStart(2, "0")}`, name: `receipt:${y}-${String((y + 1) % 100).padStart(2, "0")}` };
};
let visitsAdded = 0;
let donationsAdded = 0;
for (const [i, [name, mobile, address, purpose, donationType, amount]] of VISITORS.entries()) {
  const back = 16 - i;
  const pending = back <= 1;
  const visitor = await prisma.visitor.create({
    data: { ...base, key: `demo:${mobile}`, name, mobile, address, visitCount: 1, firstVisitAt: day(back), lastVisitAt: day(back) },
  });
  const visit = await prisma.visit.create({
    data: {
      ...base,
      visitorId: visitor.id,
      date: day(back),
      serialNo: 1,
      time: `${String(10 + (i % 7)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`,
      visitorName: name,
      mobile,
      address,
      purpose,
      purposeRaw: purpose,
      extraRemark: `${TAG} नमुना भेट / Sample visit`,
      flags: [],
      status: pending ? "PENDING" : "APPROVED",
      createdById: store.id,
      ...(pending ? {} : { approvedById: admin.id, approvedAt: at(back, 19) }),
      createdAt: at(back, 11),
    },
  });
  visitsAdded++;
  if (donationType) {
    let receiptNo: string | null = null;
    if (!pending) {
      const c = counterName(day(back));
      const n = await prisma.counter.upsert({
        where: { clientId_name: { clientId: client.id, name: c.name } },
        create: { clientId: client.id, name: c.name, value: 1 },
        update: { value: { increment: 1 } },
      });
      receiptNo = `${client.code}/${c.fy}/${String(n.value).padStart(4, "0")}`;
    }
    const description =
      donationType === "CASH" ? "रोख देणगी / Cash donation" : donationType === "CLOTH" ? "मुलांचे कपडे २ पिशव्या / Children's clothes, 2 bags" : donationType === "MEAL" ? "मुलांना एक वेळचे जेवण / One meal for the children" : "गहू व तांदूळ / Wheat and rice";
    await prisma.donation.create({
      data: {
        ...base,
        visitId: visit.id,
        date: day(back),
        donorName: name,
        donorMobile: mobile,
        donorAddress: address,
        type: donationType,
        description: `${TAG} ${description}`,
        amount: amount ?? null,
        receiptNo,
        status: pending ? "PENDING" : "APPROVED",
        createdById: store.id,
        createdAt: at(back, 11),
      },
    });
    donationsAdded++;
  }
}

await prisma.entry.createMany({ data: entries });
await prisma.stockMovement.createMany({ data: moves });
await prisma.auditLog.createMany({ data: audits });

const perModule = new Map<string, number>();
for (const e of entries) perModule.set(e.module, (perModule.get(e.module) ?? 0) + 1);
console.log(`Added ${entries.length} register entries (${[...perModule].map(([m, n]) => `${m} ${n}`).join(", ")}), ${moves.length} stock movements, ${visitsAdded} visits, ${donationsAdded} donations.`);
await prisma.$disconnect();
