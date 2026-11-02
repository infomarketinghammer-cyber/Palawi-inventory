// Register definitions. Each paper register is configured here; one generic engine handles
// entry, approval, stock posting, listing, printing and export. Pure data so client and server share it.

export type Role = "STORE_USER" | "ADMIN";

export const MODULE_KEYS = [
  "grain",
  "meals",
  "vegetables",
  "fruit",
  "personal",
  "cleaning",
  "utensils",
  "expenses",
  "purchase",
  "adjustment",
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

/**
 * How a register's lines move stock:
 * - sameday: bought and used the same day (IN + OUT of the same qty)               — vegetables, fruit
 * - out:     taken from stock (OUT consumption or distribution, see `outType`)     — grain, personal items, cleaning
 * - kind:    each line picks a kind (purchase, issue, return, damage, ...)         — stock in, utensils, adjustment
 * - none:    no item lines                                                          — meals, expenses
 * Stock only comes in through the Stock in register (or a donation at the gate).
 */
export type LineMode = "sameday" | "out" | "kind" | "none";

export type FieldType = "text" | "textarea" | "number" | "select" | "date";
export type HeaderField = {
  name: string;
  type: FieldType;
  required?: boolean;
  options?: readonly string[];
  /** Only an admin can set it (e.g. medical officer verification). */
  adminOnly?: boolean;
};
export type LineExtra = "source" | "donorName" | "rate" | "acknowledged" | "note" | "expiryDate";

export type ModuleConfig = {
  key: ModuleKey;
  categories: readonly string[];
  lineMode: LineMode;
  kinds?: readonly string[];
  /** Ledger type for "out" lines: consumption (eaten/used up) or distribution (issued). Default distribution. */
  outType?: "consumption" | "distribution";
  /** Translation key for the single quantity input. Default entries.qty. */
  qtyLabel?: string;
  childCount: boolean;
  header: readonly HeaderField[];
  lineExtras: readonly LineExtra[];
  createRoles: readonly Role[];
  /** Shown on the home page as a register card. */
  listed: boolean;
};

export const CATEGORIES = [
  "GRAIN",
  "PULSES",
  "SPICES",
  "OIL",
  "DAIRY",
  "FUEL",
  "PROVISIONS",
  "VEGETABLE",
  "FRUIT",
  "PERSONAL",
  "CLEANING",
  "UTENSIL",
  "BEDDING",
  "STATIONERY",
  "OTHER",
] as const;
export const VEG_GROUPS = ["LEAFY", "FRUIT_VEG", "ROOTS", "MASALA"] as const;
export const UNITS = ["kg", "g", "l", "ml", "piece", "packet", "set", "dozen", "bag", "cylinder"] as const;
export const EXPENSE_CATEGORIES = ["SERVICE", "PURCHASE", "MAINTENANCE", "UTILITY", "MEDICAL", "OTHER"] as const;

const PROVISIONS = ["GRAIN", "PULSES", "SPICES", "OIL", "DAIRY", "FUEL", "PROVISIONS"] as const;
// The store user records; the admin views, approves, rejects and unlocks (stock adjustments are the admin's own).
const STORE: readonly Role[] = ["STORE_USER"];

export const MODULES: Record<ModuleKey, ModuleConfig> = {
  grain: {
    key: "grain",
    categories: PROVISIONS,
    lineMode: "out",
    outType: "consumption",
    qtyLabel: "entries.outQty",
    childCount: true,
    header: [],
    lineExtras: [],
    createRoles: STORE,
    listed: true,
  },
  meals: {
    key: "meals",
    categories: [],
    lineMode: "none",
    childCount: true,
    header: [
      { name: "breakfast", type: "textarea" },
      { name: "lunch", type: "textarea" },
      { name: "snack", type: "textarea" },
      { name: "dinner", type: "textarea" },
    ],
    lineExtras: [],
    createRoles: STORE,
    listed: true,
  },
  vegetables: {
    key: "vegetables",
    categories: ["VEGETABLE"],
    lineMode: "sameday",
    childCount: true,
    header: [],
    lineExtras: [],
    createRoles: STORE,
    listed: true,
  },
  fruit: {
    key: "fruit",
    categories: ["FRUIT"],
    lineMode: "sameday",
    childCount: true,
    header: [],
    lineExtras: ["source", "donorName"],
    createRoles: STORE,
    listed: true,
  },
  personal: {
    key: "personal",
    categories: ["PERSONAL"],
    lineMode: "out",
    childCount: true,
    header: [],
    lineExtras: ["acknowledged", "note"],
    createRoles: STORE,
    listed: true,
  },
  cleaning: {
    key: "cleaning",
    categories: ["CLEANING"],
    lineMode: "out",
    childCount: false,
    header: [
      { name: "workerName", type: "text", required: true },
      { name: "medicalOfficerName", type: "text", adminOnly: true },
      { name: "medicalOfficerDate", type: "date", adminOnly: true },
    ],
    lineExtras: ["note"],
    createRoles: STORE,
    listed: true,
  },
  utensils: {
    key: "utensils",
    categories: ["UTENSIL", "BEDDING", "STATIONERY"],
    lineMode: "kind",
    kinds: ["issue", "return", "damage", "loss"],
    childCount: false,
    header: [{ name: "issuedTo", type: "text" }],
    lineExtras: ["note"],
    createRoles: STORE,
    listed: true,
  },
  expenses: {
    key: "expenses",
    categories: [],
    lineMode: "none",
    childCount: false,
    header: [
      { name: "description", type: "text", required: true },
      { name: "category", type: "select", options: EXPENSE_CATEGORIES, required: true },
      { name: "perHeadRate", type: "number" },
      { name: "headcount", type: "number" },
      { name: "total", type: "number", required: true },
      { name: "paidBy", type: "text" },
      { name: "billNo", type: "text" },
    ],
    lineExtras: [],
    createRoles: STORE,
    listed: true,
  },
  purchase: {
    key: "purchase",
    categories: CATEGORIES,
    lineMode: "kind",
    kinds: ["purchase", "donation", "opening"],
    childCount: false,
    header: [
      { name: "supplier", type: "text" },
      { name: "billNo", type: "text" },
    ],
    lineExtras: ["rate", "donorName", "expiryDate"],
    createRoles: STORE,
    listed: true,
  },
  adjustment: {
    key: "adjustment",
    categories: CATEGORIES,
    lineMode: "kind",
    kinds: ["adjust_in", "adjust_out"],
    childCount: false,
    header: [{ name: "reason", type: "text", required: true }],
    lineExtras: ["note"],
    createRoles: ["ADMIN"],
    listed: true,
  },
};

export function isModuleKey(v: string): v is ModuleKey {
  return (MODULE_KEYS as readonly string[]).includes(v);
}

/** Kinds that add to stock; all others remove. */
export const IN_KINDS = new Set(["purchase", "donation", "opening", "return", "adjust_in"]);

/** Ledger movement type for a line kind. */
export function kindToType(kind: string): string {
  if (kind === "issue") return "distribution";
  if (kind === "adjust_in" || kind === "adjust_out") return "adjustment";
  return kind;
}
