import "server-only";
import type { Prisma } from "@prisma/client";
import { audit } from "./audit";
import { tenantDb, type TenantDb, type TenantTx } from "./tenant";
import { MODULES, type ModuleKey } from "./modules";
import { computeBalances, findShortages, linesToMovements, type Shortage } from "./stock";
import type { EntryInput } from "./entry-form";
import type { Session } from "./session-token";

export type EngineResult = { ok: true; id: string } | { ok: false; error: string; shortages?: Shortage[] };

export const dayToDate = (day: string) => new Date(`${day}T00:00:00Z`);
export const dateToDay = (d: Date) => d.toISOString().slice(0, 10);

/** Balances per item for an institution: approved, pending in and pending out (optionally ignoring one entry). */
export async function getBalances(db: TenantDb, institutionId: string, opts: { itemIds?: string[]; excludeEntryId?: string; before?: Date } = {}) {
  const rows = await db.stockMovement.groupBy({
    by: ["itemId", "direction", "status"],
    where: {
      institutionId,
      status: { in: ["PENDING", "APPROVED"] },
      ...(opts.itemIds ? { itemId: { in: opts.itemIds } } : {}),
      ...(opts.excludeEntryId ? { entryId: { not: opts.excludeEntryId } } : {}),
      ...(opts.before ? { date: { lt: opts.before } } : {}),
    },
    _sum: { qty: true },
  });
  return computeBalances(rows.map((r) => ({ itemId: r.itemId, direction: r.direction, status: r.status, qty: r._sum.qty ?? 0 })));
}

async function checkItems(db: TenantDb, module: ModuleKey, input: EntryInput): Promise<string | null> {
  const ids = [...new Set(input.lines.map((l) => l.itemId))];
  if (!ids.length) return null;
  const items = await db.item.findMany({ where: { id: { in: ids }, active: true }, select: { id: true, category: true } });
  const allowed = new Set(MODULES[module].categories);
  if (items.length !== ids.length || items.some((i) => !allowed.has(i.category))) return "entries.badItem";
  return null;
}

/** Stock that may be used when entering: approved + pending in − pending out of other entries. */
async function entryShortages(db: TenantDb, institutionId: string, module: ModuleKey, input: EntryInput, excludeEntryId?: string) {
  const movements = linesToMovements(module, input.lines);
  if (!movements.some((m) => m.direction === "OUT")) return [];
  const bal = await getBalances(db, institutionId, { itemIds: movements.map((m) => m.itemId), excludeEntryId });
  return findShortages(movements, (id) => {
    const b = bal.get(id);
    return b ? b.approved + b.pendingIn - b.pendingOut : 0;
  });
}

function movementRows(session: Session, institutionId: string, module: ModuleKey, entryId: string, input: EntryInput) {
  return linesToMovements(module, input.lines).map((m) => ({
    clientId: session.clientId,
    institutionId,
    itemId: m.itemId,
    qty: m.qty,
    direction: m.direction,
    type: m.type,
    module,
    entryId,
    date: dayToDate(input.date),
    status: "PENDING" as const,
  }));
}

const linesForDb = (input: EntryInput): Prisma.EntryLineCreateInput[] =>
  input.lines.map((l) => ({ ...l, expiryDate: l.expiryDate ? dayToDate(l.expiryDate) : null }));

export async function createEntry(session: Session, module: ModuleKey, input: EntryInput): Promise<EngineResult> {
  if (!MODULES[module].createRoles.includes(session.role)) return { ok: false, error: "common.denied" };
  if (!session.institutionId) return { ok: false, error: "home.noInstitution" };
  const institutionId = session.institutionId;
  const db = tenantDb(session.clientId);
  const bad = await checkItems(db, module, input);
  if (bad) return { ok: false, error: bad };
  const shortages = await entryShortages(db, institutionId, module, input);
  if (shortages.length) return { ok: false, error: "entries.insufficient", shortages };

  const entry = await db.$transaction(async (tx) => {
    const e = await tx.entry.create({
      data: {
        clientId: session.clientId,
        institutionId,
        module,
        date: dayToDate(input.date),
        childCount: input.childCount,
        fields: input.fields,
        lines: linesForDb(input),
        remarks: input.remarks,
        createdById: session.userId,
        createdByName: session.name,
      },
    });
    const rows = movementRows(session, institutionId, module, e.id, input);
    if (rows.length) await tx.stockMovement.createMany({ data: rows });
    await audit(session, { action: "create", entity: "Entry", entityId: e.id, newValue: { module, ...input } }, tx);
    return e;
  });
  return { ok: true, id: entry.id };
}

/**
 * Approved stock just before an entry: everything approved on earlier days plus entries approved
 * earlier on the same day (e.g. the morning's purchase before the day's consumption).
 */
export async function openingForEntry(db: TenantDb, entry: { id: string; institutionId: string; date: Date; createdAt: Date }, itemIds: string[]) {
  const before = await getBalances(db, entry.institutionId, { before: entry.date, itemIds });
  const earlier = await db.entry.findMany({
    where: { institutionId: entry.institutionId, date: entry.date, status: "APPROVED", createdAt: { lt: entry.createdAt }, id: { not: entry.id } },
    select: { id: true },
  });
  if (earlier.length) {
    const same = await db.stockMovement.groupBy({
      by: ["itemId", "direction"],
      where: { entryId: { in: earlier.map((e) => e.id) }, itemId: { in: itemIds }, status: "APPROVED" },
      _sum: { qty: true },
    });
    for (const r of same) {
      const b = before.get(r.itemId) ?? { approved: 0, pendingIn: 0, pendingOut: 0 };
      b.approved = Math.round((b.approved + (r.direction === "IN" ? 1 : -1) * (r._sum.qty ?? 0)) * 1000) / 1000;
      before.set(r.itemId, b);
    }
  }
  return before;
}

/**
 * Only the person who recorded an entry may edit or delete it, while it is pending or rejected.
 * The admin reviews (approve / reject / unlock) but does not change store entries.
 */
export function canEdit(session: Session, entry: { status: string; createdById: string }) {
  if (entry.status === "APPROVED") return false;
  return entry.createdById === session.userId;
}

export async function updateEntry(session: Session, id: string, input: EntryInput): Promise<EngineResult> {
  const db = tenantDb(session.clientId);
  const before = await db.entry.findFirst({ where: { id } });
  if (!before) return { ok: false, error: "entries.notFound" };
  if (!canEdit(session, before)) return { ok: false, error: "entries.locked" };
  const mod = before.module as ModuleKey;
  // Admin-only header fields keep their value when a store user edits.
  const prevFields = (before.fields ?? {}) as Record<string, string | number | null>;
  for (const f of MODULES[mod].header) if (f.adminOnly && session.role !== "ADMIN") input.fields[f.name] = prevFields[f.name] ?? null;
  const bad = await checkItems(db, mod, input);
  if (bad) return { ok: false, error: bad };
  const shortages = await entryShortages(db, before.institutionId, mod, input, id);
  if (shortages.length) return { ok: false, error: "entries.insufficient", shortages };

  await db.$transaction(async (tx) => {
    await tx.entry.update({
      where: { id },
      data: {
        date: dayToDate(input.date),
        childCount: input.childCount,
        fields: input.fields,
        lines: { set: linesForDb(input) },
        remarks: input.remarks,
        status: "PENDING",
        rejectReason: null,
      },
    });
    await tx.stockMovement.deleteMany({ where: { entryId: id } });
    const rows = movementRows(session, before.institutionId, mod, id, input);
    if (rows.length) await tx.stockMovement.createMany({ data: rows });
    await audit(
      session,
      {
        action: "update",
        entity: "Entry",
        entityId: id,
        oldValue: { date: dateToDay(before.date), childCount: before.childCount, fields: before.fields, lines: before.lines, remarks: before.remarks, status: before.status },
        newValue: input,
      },
      tx,
    );
  });
  return { ok: true, id };
}

/** Sets admin-only header fields (e.g. medical officer verification) at any status. */
export async function setAdminFields(session: Session, id: string, values: Record<string, string | null>): Promise<EngineResult> {
  if (session.role !== "ADMIN") return { ok: false, error: "common.denied" };
  const db = tenantDb(session.clientId);
  const e = await db.entry.findFirst({ where: { id } });
  if (!e) return { ok: false, error: "entries.notFound" };
  const allowed = MODULES[e.module as ModuleKey].header.filter((f) => f.adminOnly).map((f) => f.name);
  const prev = (e.fields ?? {}) as Record<string, unknown>;
  const next = { ...prev };
  for (const k of allowed) next[k] = values[k]?.trim() || null;
  await db.entry.update({ where: { id }, data: { fields: next as Prisma.InputJsonValue } });
  await audit(session, { action: "update", entity: "Entry", entityId: id, oldValue: Object.fromEntries(allowed.map((k) => [k, prev[k] ?? null])), newValue: Object.fromEntries(allowed.map((k) => [k, next[k]])) });
  return { ok: true, id };
}

async function nextReceiptNo(tx: TenantTx, clientId: string, clientCode: string, date: Date) {
  const y = date.getUTCMonth() >= 3 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  const fy = `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
  const c = await tx.counter.upsert({
    where: { clientId_name: { clientId, name: `receipt:${fy}` } },
    create: { clientId, name: `receipt:${fy}`, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${clientCode}/${fy}/${String(c.value).padStart(4, "0")}`;
}

/** Approves donations tied to an entry or visit and gives each a receipt number. */
export async function approveDonations(session: Session, tx: TenantTx, where: Prisma.DonationWhereInput) {
  const client = await tx.client.findUniqueOrThrow({ where: { id: session.clientId }, select: { code: true } });
  const donations = await tx.donation.findMany({ where: { ...where, clientId: session.clientId, status: "PENDING", deletedAt: { isSet: false } } });
  for (const d of donations) {
    await tx.donation.update({
      where: { id: d.id },
      data: { status: "APPROVED", receiptNo: d.receiptNo ?? (await nextReceiptNo(tx, session.clientId, client.code, d.date)) },
    });
  }
}

export async function approveEntry(session: Session, id: string, overrideReason?: string): Promise<EngineResult> {
  if (session.role !== "ADMIN") return { ok: false, error: "common.denied" };
  const db = tenantDb(session.clientId);
  const e = await db.entry.findFirst({ where: { id } });
  if (!e) return { ok: false, error: "entries.notFound" };
  if (e.status !== "PENDING") return { ok: false, error: "entries.notPending" };

  // At approval only approved stock counts. Negative stock needs an explicit admin reason.
  const movements = linesToMovements(e.module as ModuleKey, e.lines);
  if (movements.some((m) => m.direction === "OUT")) {
    const bal = await getBalances(db, e.institutionId, { itemIds: movements.map((m) => m.itemId) });
    const shortages = findShortages(movements, (itemId) => bal.get(itemId)?.approved ?? 0);
    if (shortages.length && !overrideReason?.trim()) return { ok: false, error: "entries.insufficientApproved", shortages };
  }

  await db.$transaction(async (tx) => {
    await tx.entry.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedById: session.userId,
        approvedByName: session.name,
        approvedAt: new Date(),
        overrideReason: overrideReason?.trim() || null,
      },
    });
    await tx.stockMovement.updateMany({ where: { entryId: id }, data: { status: "APPROVED" } });
    await approveDonations(session, tx, { entryId: id });
    await audit(session, { action: "approve", entity: "Entry", entityId: id, reason: overrideReason?.trim() || undefined }, tx);
  });
  return { ok: true, id };
}

export async function rejectEntry(session: Session, id: string, reason: string): Promise<EngineResult> {
  if (session.role !== "ADMIN") return { ok: false, error: "common.denied" };
  if (!reason.trim()) return { ok: false, error: "entries.reasonRequired" };
  const db = tenantDb(session.clientId);
  const e = await db.entry.findFirst({ where: { id } });
  if (!e) return { ok: false, error: "entries.notFound" };
  if (e.status !== "PENDING") return { ok: false, error: "entries.notPending" };
  await db.$transaction(async (tx) => {
    await tx.entry.update({ where: { id }, data: { status: "REJECTED", rejectReason: reason.trim() } });
    await tx.stockMovement.updateMany({ where: { entryId: id }, data: { status: "REJECTED" } });
    await tx.donation.updateMany({ where: { entryId: id, clientId: session.clientId }, data: { status: "REJECTED" } });
    await audit(session, { action: "reject", entity: "Entry", entityId: id, reason: reason.trim() }, tx);
  });
  return { ok: true, id };
}

export async function unlockEntry(session: Session, id: string, reason: string): Promise<EngineResult> {
  if (session.role !== "ADMIN") return { ok: false, error: "common.denied" };
  if (!reason.trim()) return { ok: false, error: "entries.reasonRequired" };
  const db = tenantDb(session.clientId);
  const e = await db.entry.findFirst({ where: { id } });
  if (!e) return { ok: false, error: "entries.notFound" };
  if (e.status !== "APPROVED") return { ok: false, error: "entries.notApproved" };
  await db.$transaction(async (tx) => {
    await tx.entry.update({
      where: { id },
      data: { status: "PENDING", approvedById: null, approvedByName: null, approvedAt: null, overrideReason: null },
    });
    await tx.stockMovement.updateMany({ where: { entryId: id }, data: { status: "PENDING" } });
    await audit(session, { action: "unlock", entity: "Entry", entityId: id, oldValue: { approvedBy: e.approvedByName, approvedAt: e.approvedAt }, reason: reason.trim() }, tx);
  });
  return { ok: true, id };
}

export async function deleteEntry(session: Session, id: string): Promise<EngineResult> {
  const db = tenantDb(session.clientId);
  const e = await db.entry.findFirst({ where: { id } });
  if (!e) return { ok: false, error: "entries.notFound" };
  if (!canEdit(session, e)) return { ok: false, error: "entries.locked" };
  await db.$transaction(async (tx) => {
    await tx.entry.update({ where: { id }, data: { deletedAt: new Date() } });
    await tx.stockMovement.deleteMany({ where: { entryId: id } });
    await tx.donation.updateMany({ where: { entryId: id, clientId: session.clientId }, data: { deletedAt: new Date() } });
    await audit(session, { action: "delete", entity: "Entry", entityId: id, oldValue: { module: e.module, date: dateToDay(e.date), lines: e.lines } }, tx);
  });
  return { ok: true, id };
}

/** Approves everything pending on one day (all registers + gate visits). Entries short of stock are skipped. */
export async function approveDay(session: Session, day: string) {
  if (session.role !== "ADMIN") return { approved: 0, skipped: 0 };
  const db = tenantDb(session.clientId);
  const date = dayToDate(day);
  let pending = await db.entry.findMany({
    where: { date, status: "PENDING", ...(session.institutionId ? { institutionId: session.institutionId } : {}) },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  let approved = 0;
  // Second pass: an entry that consumes stock may have been reached before the purchase that funds it.
  for (let pass = 0; pass < 2 && pending.length; pass++) {
    const retry: typeof pending = [];
    for (const p of pending) {
      const r = await approveEntry(session, p.id);
      if (r.ok) approved++;
      else retry.push(p);
    }
    pending = retry;
  }
  let skipped = pending.length;
  const { approveVisit } = await import("./visits");
  const visits = await db.visit.findMany({ where: { date, status: "PENDING" }, select: { id: true } });
  for (const v of visits) {
    const r = await approveVisit(session, v.id);
    if (r.ok) approved++;
    else skipped++;
  }
  return { approved, skipped };
}
