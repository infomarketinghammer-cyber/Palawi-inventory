import "server-only";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import type { Prisma } from "@prisma/client";
import { audit } from "./audit";
import { tenantDb } from "./tenant";
import { prisma } from "./db";
import { guessDonationType, parseGateRows, visitorKey, type ParsedVisit } from "./gate";
import { dayToDate } from "./entries";
import type { Session } from "./session-token";

const CHUNK = 500;

/** Parses an uploaded gate register and stores it as a dry run for review. Nothing else is written. */
export async function dryRunGateImport(session: Session, fileName: string, data: ArrayBuffer) {
  if (!session.institutionId) throw new Error("No institution");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);
  const ws = wb.worksheets[0];
  if (!ws) return { ok: false as const, error: "imports.noSheet" };
  const header = (ws.getRow(1).values as unknown[]).map((v) => String(v ?? "").trim().toLowerCase());
  if (!header.includes("visitor name")) return { ok: false as const, error: "imports.badHeader" };

  const rows: { n: number; values: unknown[] }[] = [];
  ws.eachRow({ includeEmpty: false }, (r, n) => rows.push({ n, values: r.values as unknown[] }));
  const parsed = parseGateRows(rows);
  const batch = await tenantDb(session.clientId).importBatch.create({
    data: {
      clientId: session.clientId,
      institutionId: session.institutionId,
      kind: "gate",
      fileName,
      status: "DRY_RUN",
      stats: parsed.stats,
      issues: parsed.issues as unknown as Prisma.InputJsonValue,
      rows: parsed.visits as unknown as Prisma.InputJsonValue,
      createdById: session.userId,
    },
  });
  return { ok: true as const, id: batch.id };
}

/** Creates visitor profiles, visits and donations from a reviewed dry run. Imported history is marked approved. */
export async function commitGateImport(session: Session, batchId: string) {
  const db = tenantDb(session.clientId);
  const batch = await db.importBatch.findFirst({ where: { id: batchId } });
  if (!batch || batch.status !== "DRY_RUN") return { ok: false as const, error: "imports.notDryRun" };
  const institutionId = batch.institutionId;
  const rows = (batch.rows ?? []) as unknown as ParsedVisit[];
  const now = new Date();

  // Visitor profiles: reuse existing ones, create the rest in bulk with our own ids.
  const existing = await db.visitor.findMany({ where: { institutionId }, select: { id: true, key: true, visitCount: true } });
  const byKey = new Map(existing.map((v) => [v.key, { id: v.id, count: v.visitCount, isNew: false, first: null as Date | null, last: null as Date | null, row: null as ParsedVisit | null }]));
  const sorted = [...rows].sort((a, b) => (a.date === b.date ? a.sourceRow - b.sourceRow : a.date < b.date ? -1 : 1));
  const visits: Prisma.VisitCreateManyInput[] = [];
  for (const r of sorted) {
    const key = visitorKey(r.visitorName, r.mobile, r.address);
    let v = byKey.get(key);
    if (!v) {
      v = { id: randomUUID(), count: 0, isNew: true, first: null, last: null, row: r };
      byKey.set(key, v);
    }
    v.count++;
    const d = dayToDate(r.date);
    v.first = v.first && v.first < d ? v.first : d;
    v.last = v.last && v.last > d ? v.last : d;
    visits.push({
      id: randomUUID(),
      clientId: session.clientId,
      institutionId,
      visitorId: v.id,
      date: d,
      serialNo: r.serialNo,
      time: r.time,
      visitorName: r.visitorName,
      dob: r.dob ? dayToDate(r.dob) : null,
      mobile: r.mobile,
      address: r.address,
      purpose: r.purpose,
      purposeRaw: r.purposeRaw,
      extraRemark: r.extraRemark,
      visitNo: r.visitNo ?? v.count,
      flags: r.flags,
      status: "APPROVED",
      approvedById: session.userId,
      approvedAt: now,
      importBatchId: batchId,
      sourceRow: r.sourceRow,
    });
  }

  const newVisitors: Prisma.VisitorCreateManyInput[] = [];
  for (const [key, v] of byKey) {
    if (!v.isNew || !v.row) continue;
    newVisitors.push({
      id: v.id,
      clientId: session.clientId,
      institutionId,
      key,
      name: v.row.visitorName,
      mobile: v.row.mobile,
      dob: v.row.dob ? dayToDate(v.row.dob) : null,
      address: v.row.address,
      visitCount: v.count,
      firstVisitAt: v.first,
      lastVisitAt: v.last,
    });
  }
  // Donations recorded at the gate (historical: not posted to stock, quantities are free text).
  const donationVisits = visits.filter((v) => v.purpose === "DONATION" || v.purpose === "FOOD_MEAL");
  const client = await prisma.client.findUniqueOrThrow({ where: { id: session.clientId }, select: { code: true } });
  const counters = new Map<string, number>();
  const donations: Prisma.DonationCreateManyInput[] = [];
  for (const v of donationVisits) {
    const d = v.date as Date;
    const y = d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
    const fy = `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
    if (!counters.has(fy)) {
      const c = await db.counter.findFirst({ where: { name: `receipt:${fy}` } });
      counters.set(fy, c?.value ?? 0);
    }
    const n = counters.get(fy)! + 1;
    counters.set(fy, n);
    const description = v.extraRemark || v.purposeRaw || null;
    donations.push({
      clientId: session.clientId,
      institutionId,
      visitId: v.id,
      date: d,
      donorName: v.visitorName,
      donorMobile: v.mobile,
      donorAddress: v.address,
      type: v.purpose === "FOOD_MEAL" ? "MEAL" : guessDonationType(description),
      description,
      receiptNo: `${client.code}/${fy}/${String(n).padStart(4, "0")}`,
      status: "APPROVED",
      importBatchId: batchId,
      createdById: session.userId,
    });
  }
  // Writes. On any failure, remove what this import created so a retry starts clean.
  const existingCounts = [...byKey.values()].filter((v) => !v.isNew && v.first);
  try {
    for (let i = 0; i < newVisitors.length; i += CHUNK) await db.visitor.createMany({ data: newVisitors.slice(i, i + CHUNK) });
    for (let i = 0; i < visits.length; i += CHUNK) await db.visit.createMany({ data: visits.slice(i, i + CHUNK) });
    for (let i = 0; i < donations.length; i += CHUNK) await db.donation.createMany({ data: donations.slice(i, i + CHUNK) });
    for (const v of existingCounts) await db.visitor.update({ where: { id: v.id }, data: { visitCount: v.count } });
    for (const [fy, value] of counters) {
      await db.counter.upsert({
        where: { clientId_name: { clientId: session.clientId, name: `receipt:${fy}` } },
        create: { clientId: session.clientId, name: `receipt:${fy}`, value },
        update: { value },
      });
    }
  } catch (e) {
    await db.donation.deleteMany({ where: { importBatchId: batchId } });
    await db.visit.deleteMany({ where: { importBatchId: batchId } });
    const ids = newVisitors.map((v) => v.id!);
    for (let i = 0; i < ids.length; i += CHUNK) await db.visitor.deleteMany({ where: { id: { in: ids.slice(i, i + CHUNK) } } });
    throw e;
  }

  const stats = { ...(batch.stats as object), visitorsCreated: newVisitors.length, visitsCreated: visits.length, donationsCreated: donations.length };
  await db.importBatch.update({ where: { id: batchId }, data: { status: "COMMITTED", committedAt: now, stats } });
  await audit(session, { action: "create", entity: "ImportBatch", entityId: batchId, newValue: stats });
  return { ok: true as const, stats };
}

/** Removes everything a committed import created and recounts visitor profiles. */
export async function rollbackGateImport(session: Session, batchId: string) {
  const db = tenantDb(session.clientId);
  const batch = await db.importBatch.findFirst({ where: { id: batchId } });
  if (!batch || batch.status !== "COMMITTED") return { ok: false as const, error: "imports.notCommitted" };
  const removedDonations = await db.donation.deleteMany({ where: { importBatchId: batchId } });
  const removedVisits = await db.visit.deleteMany({ where: { importBatchId: batchId } });
  const counts = await db.visit.groupBy({ by: ["visitorId"], where: { institutionId: batch.institutionId }, _count: { _all: true } });
  const live = new Map(counts.map((c) => [c.visitorId, c._count._all]));
  const visitors = await db.visitor.findMany({ where: { institutionId: batch.institutionId }, select: { id: true, visitCount: true } });
  const orphaned = visitors.filter((v) => !live.has(v.id)).map((v) => v.id);
  for (let i = 0; i < orphaned.length; i += CHUNK) await db.visitor.deleteMany({ where: { id: { in: orphaned.slice(i, i + CHUNK) } } });
  for (const v of visitors) {
    const c = live.get(v.id);
    if (c !== undefined && c !== v.visitCount) await db.visitor.update({ where: { id: v.id }, data: { visitCount: c } });
  }
  await db.importBatch.update({ where: { id: batchId }, data: { status: "ROLLED_BACK", rolledBackAt: new Date() } });
  await audit(session, { action: "delete", entity: "ImportBatch", entityId: batchId, oldValue: { visits: removedVisits.count, donations: removedDonations.count } });
  return { ok: true as const };
}
