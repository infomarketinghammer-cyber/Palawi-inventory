import { z } from "zod";
import { CATEGORIES, UNITS, VEG_GROUPS } from "./modules.ts";

// Error messages are translation keys under "validation.*" (with optional ":param"),
// rendered by translateError() so every message is bilingual.

// A field missing from the submission is treated like an empty one.
const str = () => z.string({ error: "required" });
const req = (max = 200) => str().trim().min(1, "required").max(max, `tooLong:${max}`);
const opt = (max = 200) =>
  z
    .string()
    .trim()
    .max(max, `tooLong:${max}`)
    .transform((v) => (v === "" ? undefined : v))
    .optional();

const code = str()
  .trim()
  .toUpperCase()
  .min(2, "tooShort:2")
  .max(20, "tooLong:20")
  .regex(/^[A-Z0-9-]+$/, "code");

const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, "").replace(/^\+?91(?=\d{10}$)/, ""))
  .refine((v) => v === "" || /^[6-9]\d{9}$/.test(v), "phone")
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const email = z
  .string()
  .trim()
  .toLowerCase()
  .refine((v) => v === "" || z.email().safeParse(v).success, "email")
  .transform((v) => (v === "" ? undefined : v))
  .optional();

export const password = str().min(8, "tooShort:8").max(128, "tooLong:128");

export const loginSchema = z.object({
  identifier: req(120),
  password: str().min(1, "required"),
});

export const institutionSchema = z.object({
  code,
  nameMr: req(),
  nameEn: req(),
  cityMr: opt(),
  cityEn: opt(),
  address: opt(500),
});

const userBase = z.object({
  name: req(120),
  email,
  phone,
  password,
});

const withIdentifier = <T extends { email?: string; phone?: string }>(v: T, ctx: z.RefinementCtx) => {
  if (!v.email && !v.phone) {
    ctx.addIssue({ code: "custom", path: ["phone"], message: "identifierRequired" });
  }
};

export const userCreateSchema = userBase
  .extend({
    role: z.enum(["STORE_USER", "ADMIN"]),
    institutionId: opt(50),
  })
  .superRefine(withIdentifier);

/** A missing group of fields is parsed as {} so each of its fields is reported, not just the group. */
const group = <T extends z.ZodType>(schema: T) => z.preprocess((v) => v ?? {}, schema);

export const clientCreateSchema = z.object({
  client: group(z.object({ code, nameMr: req(), nameEn: req(), taglineMr: opt(), taglineEn: opt() })),
  institution: group(institutionSchema),
  admin: group(userBase.superRefine(withIdentifier)),
});

const optNumber = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? Number(v) : null))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0), "invalid");

export const itemSchema = z.object({
  code: z
    .string({ error: "required" })
    .trim()
    .toUpperCase()
    .min(2, "tooShort:2")
    .max(30, "tooLong:30")
    .regex(/^[A-Z0-9_-]+$/, "code"),
  nameMr: req(),
  nameEn: req(),
  category: z.enum(CATEGORIES, { error: "required" }),
  group: z
    .string()
    .optional()
    .transform((v) => (v && (VEG_GROUPS as readonly string[]).includes(v) ? v : null)),
  unit: z.enum(UNITS, { error: "required" }),
  reorderLevel: optNumber,
  perChildDailyNorm: optNumber,
  trackExpiry: z.string().optional().transform((v) => v === "on"),
  location: opt(),
});

export const passwordChangeSchema = z
  .object({ current: z.string().min(1, "required"), next: password, confirm: z.string() })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "mismatch" });

export type FieldErrors = Record<string, string>;

/** Flattens zod issues into { "a.b": "key[:param]" }, keeping the first message per field. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/** Reads nested FormData keys like "client.code" into an object. */
export function formToObject(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v !== "string" || k.startsWith("$")) continue;
    const parts = k.split(".");
    let cur = out as Record<string, unknown>;
    parts.slice(0, -1).forEach((p) => {
      cur[p] = (cur[p] as Record<string, unknown>) ?? {};
      cur = cur[p] as Record<string, unknown>;
    });
    cur[parts[parts.length - 1]] = v;
  }
  return out;
}

export type ActionState = {
  ok: boolean;
  message?: string;
  errors?: FieldErrors;
  values?: Record<string, string>;
  /** Extra already-translated lines, e.g. which items are short of stock. */
  details?: string[];
};

/** Submitted values to send back on failure (React resets forms after an action). Never echoes passwords. */
export function echo(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v === "string" && !k.startsWith("$") && !/password/i.test(k)) out[k] = v;
  }
  return out;
}

export function failed(fd: FormData, errors: FieldErrors, message?: string): ActionState {
  return { ok: false, errors, message, values: echo(fd) };
}
