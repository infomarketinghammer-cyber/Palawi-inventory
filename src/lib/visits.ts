import "server-only";
import { z } from "zod";
import { audit } from "./audit";
import { tenantDb } from "./tenant";
import { DONATION_TYPES, PURPOSES, visitorKey } from "./gate";
import { normalizeMobile } from "./format";
import { approveDonations, approveEntry, createEntry, dayToDate, type EngineResult } from "./entries";
import type { Session } from "./session-token";
import type { LineInput } from "./entry-form";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "required");
const optText = (max: number) => z.string().trim().max(max, `tooLong:${max}`).optional().transform((v) => v || null);

export const visitSchema = z
  .object({
    date: day,
    time: z.string().trim().regex(/^(\d{2}:\d{2})?$/, "invalid").optional().transform((v) => v || null),
    visitorName: z.string({ error: "required" }).trim().min(1, "required").max(150, "tooLong:150"),
    dob: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "invalid").optional().transform((v) => v || null),
    mobile: z
      .string()
      .optional()
      .transform((v) => (v?.trim() ? normalizeMobile(v) ?? "BAD" : null))
      .refine((v) => v !== "BAD", "phone"),
    address: optText(300),
    purpose: z.enum(PURPOSES, { error: "required" }),
    extraRemark: optText(500),
    donation: z
      .object({
        type: z.enum(DONATION_TYPES).optional(),
        description: optText(1000),
        amount: z.string().optional().transform((v) => (v?.trim() ? Number(v) : null)).refine((v) => v === null || (Number.isFinite(v) && v > 0), "invalid"),
        lines: z.record(z.string(), z.object({ itemId: z.string().optional(), qty: z.string().optional() })).optional(),
      })
      .optional(),
  })
  .superRefine((v, ctx) => {
    if (v.purpose === "DONATION" || v.purpose === "FOOD_MEAL") {
      if (!v.donation?.type) ctx.addIssue({ code: "custom", path: ["donation", "type"], message: "required" });
      if (v.donation?.type === "CASH" && !v.donation.amount) ctx.addIssue({ code: "custom", path: ["donation", "amount"], message: "required" });
    }
  });
export type VisitInput = z.infer<typeof visitSchema>;

/** Records a gate visit. A donation visit also creates a Donation and, for goods with items, a pending stock-in entry. */
export async function createVisit(session: Session, input: VisitInput, today: string): Promise<EngineResult> {
  // Visits are recorded at the gate by the store user; the admin reviews them.
  if (session.role !== "STORE_USER") return { ok: false, error: "common.denied" };
  if (!session.institutionId) return { ok: false, error: "home.noInstitution" };
  if (input.date > today) return { ok: false, error: "entries.futureDate" };
  const institutionId = session.institutionId;
  const db = tenantDb(session.clientId);
  const date = dayToDate(input.date);

  const key = visitorKey(input.visitorName, input.mobile, input.address);
  const existing = await db.visitor.findFirst({ where: { institutionId, key } });
  const visitor = existing
    ? await db.visitor.update({
        where: { id: existing.id },
        data: {
          visitCount: { increment: 1 },
          lastVisitAt: existing.lastVisitAt && existing.lastVisitAt > date ? existing.lastVisitAt : date,
          ...(input.dob ? { dob: dayToDate(input.dob) } : {}),
          ...(input.address ? { address: input.address } : {}),
        },
      })
    : await db.visitor.create({
        data: {
          clientId: session.clientId,
          institutionId,
          key,
          name: input.visitorName,
          mobile: input.mobile,
          dob: input.dob ? dayToDate(input.dob) : null,
          address: input.address,
          visitCount: 1,
          firstVisitAt: date,
          lastVisitAt: date,
        },
      });

  const serial = (await db.visit.count({ where: { institutionId, date } })) + 1;
  const visit = await db.visit.create({
    data: {
      clientId: session.clientId,
      institutionId,
      visitorId: visitor.id,
      date,
      serialNo: serial,
      time: input.time,
      visitorName: input.visitorName,
      dob: input.dob ? dayToDate(input.dob) : null,
      mobile: input.mobile,
      address: input.address,
      purpose: input.purpose,
      purposeRaw: input.purpose,
      extraRemark: input.extraRemark,
      visitNo: visitor.visitCount,
      flags: [],
      createdById: session.userId,
    },
  });
  await audit(session, { action: "create", entity: "Visit", entityId: visit.id, newValue: { ...input, mobile: input.mobile ? "[set]" : null } });

  if ((input.purpose === "DONATION" || input.purpose === "FOOD_MEAL") && input.donation?.type) {
    let entryId: string | null = null;
    const lines: LineInput[] = Object.values(input.donation.lines ?? {})
      .filter((l) => l.itemId && l.qty && Number(l.qty) > 0)
      .map((l) => ({
        itemId: l.itemId!,
        inQty: Number(l.qty),
        outQty: null,
        kind: "donation",
        source: null,
        donorName: input.visitorName,
        rate: null,
        amount: null,
        expiryDate: null,
        acknowledged: null,
        note: null,
      }));
    if (lines.length && input.donation.type !== "CASH") {
      const r = await createEntry(session, "purchase", {
        date: input.date,
        childCount: null,
        fields: { supplier: input.visitorName, billNo: null },
        lines,
        remarks: input.donation.description,
      });
      if (!r.ok) return r;
      entryId = r.id;
    }
    const donation = await db.donation.create({
      data: {
        clientId: session.clientId,
        institutionId,
        visitId: visit.id,
        date,
        donorName: input.visitorName,
        donorMobile: input.mobile,
        donorAddress: input.address,
        type: input.donation.type,
        description: input.donation.description,
        amount: input.donation.type === "CASH" ? input.donation.amount : null,
        entryId,
        createdById: session.userId,
      },
    });
    await audit(session, { action: "create", entity: "Donation", entityId: donation.id, newValue: { type: donation.type, amount: donation.amount, description: donation.description, entryId } });
  }
  return { ok: true, id: visit.id };
}

/** Approves a visit together with its donation and the donation's stock-in entry. */
export async function approveVisit(session: Session, id: string): Promise<EngineResult> {
  if (session.role !== "ADMIN") return { ok: false, error: "common.denied" };
  const db = tenantDb(session.clientId);
  const v = await db.visit.findFirst({ where: { id } });
  if (!v) return { ok: false, error: "entries.notFound" };
  if (v.status !== "PENDING") return { ok: false, error: "entries.notPending" };
  const donations = await db.donation.findMany({ where: { visitId: id, status: "PENDING" } });
  for (const d of donations) {
    if (d.entryId) {
      const r = await approveEntry(session, d.entryId);
      if (!r.ok && r.error !== "entries.notPending") return r;
    }
  }
  await db.$transaction(async (tx) => {
    await tx.visit.update({ where: { id }, data: { status: "APPROVED", approvedById: session.userId, approvedAt: new Date() } });
    await approveDonations(session, tx, { visitId: id });
    await audit(session, { action: "approve", entity: "Visit", entityId: id }, tx);
  });
  return { ok: true, id };
}

export async function rejectVisit(session: Session, id: string, reason: string): Promise<EngineResult> {
  if (session.role !== "ADMIN") return { ok: false, error: "common.denied" };
  if (!reason.trim()) return { ok: false, error: "entries.reasonRequired" };
  const db = tenantDb(session.clientId);
  const v = await db.visit.findFirst({ where: { id } });
  if (!v || v.status !== "PENDING") return { ok: false, error: "entries.notPending" };
  const { rejectEntry } = await import("./entries");
  for (const d of await db.donation.findMany({ where: { visitId: id } })) {
    if (d.entryId) await rejectEntry(session, d.entryId, reason);
    await db.donation.update({ where: { id: d.id }, data: { status: "REJECTED" } });
  }
  await db.visit.update({ where: { id }, data: { status: "REJECTED" } });
  await audit(session, { action: "reject", entity: "Visit", entityId: id, reason });
  return { ok: true, id };
}
