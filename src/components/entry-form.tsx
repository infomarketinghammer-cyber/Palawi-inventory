"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { MODULES, type HeaderField, type ModuleKey } from "@/lib/modules";
import type { ItemOption } from "@/lib/ui-data";
import type { ActionState } from "@/lib/validation";
import { Button } from "./ui/button";
import { Card, Notice } from "./ui/card";
import { Field, Input, Select, Textarea } from "./ui/form";
import { useErrorText } from "./use-error-text";

export type LineValue = {
  itemId: string;
  inQty: string;
  outQty: string;
  qty: string;
  kind: string;
  source: string;
  donorName: string;
  rate: string;
  expiryDate: string;
  acknowledged: boolean;
  note: string;
};
export type EntryInitial = {
  date: string;
  childCount: string;
  fields: Record<string, string>;
  lines: LineValue[];
  remarks: string;
};

const emptyLine = (kind = ""): LineValue => ({
  itemId: "",
  inQty: "",
  outQty: "",
  qty: "",
  kind,
  source: "purchased",
  donorName: "",
  rate: "",
  expiryDate: "",
  acknowledged: true,
  note: "",
});

export function EntryForm({
  module,
  action,
  items,
  available,
  initial,
  today,
  isAdmin,
  suggestions = [],
  submitLabel,
}: {
  module: ModuleKey;
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  items: ItemOption[];
  /** Stock usable per item (approved + pending in − pending out). */
  available: Record<string, number>;
  initial?: EntryInitial;
  today: string;
  isAdmin: boolean;
  suggestions?: string[];
  submitLabel: string;
}) {
  const cfg = MODULES[module];
  const t = useTranslations();
  const errorText = useErrorText();
  const [state, formAction, pending] = useActionState(action, { ok: false });
  const [date, setDate] = useState(initial?.date ?? today);
  const [childCount, setChildCount] = useState(initial?.childCount ?? "");
  const [fields, setFields] = useState<Record<string, string>>(initial?.fields ?? {});
  const [remarks, setRemarks] = useState(initial?.remarks ?? "");
  const [lines, setLines] = useState<LineValue[]>(initial?.lines.length ? initial.lines : [emptyLine(cfg.kinds?.[0])]);
  const err = (k: string) => errorText(state.errors?.[k]);
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const grouped = useMemo(() => {
    const g = new Map<string, ItemOption[]>();
    for (const i of items) {
      const key = i.category === "VEGETABLE" && i.group ? `vegGroups.${i.group}` : `categories.${i.category}`;
      g.set(key, [...(g.get(key) ?? []), i]);
    }
    return [...g];
  }, [items]);

  const setLine = (idx: number, patch: Partial<LineValue>) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const visibleHeader = cfg.header.filter((f) => !f.adminOnly || isAdmin);
  const fmtQty = (n: number) => (Math.round(n * 1000) / 1000).toString();

  return (
    <form action={formAction} className="space-y-6">
      {state.message && !state.ok && (
        <Notice tone="alert">
          <p className="font-medium">{errorText(state.message)}</p>
          {state.details && (
            <ul className="mt-1 list-disc pl-5">
              {state.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </Notice>
      )}

      <Card className="grid gap-4 sm:grid-cols-2">
        <Field id="date" label={t("entries.date")} error={err("date")}>
          <Input id="date" name="date" type="date" required max={today} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {cfg.childCount && (
          <Field id="childCount" label={t("entries.childCount")} error={err("childCount")}>
            <Input
              id="childCount"
              name="childCount"
              type="number"
              inputMode="numeric"
              min={0}
              max={1000}
              required
              value={childCount}
              onChange={(e) => setChildCount(e.target.value)}
            />
          </Field>
        )}
        {visibleHeader.map((f) => (
          <HeaderInput
            key={f.name}
            field={f}
            value={fields[f.name] ?? ""}
            onChange={(v) => setFields((s) => ({ ...s, [f.name]: v }))}
            error={err(`fields.${f.name}`)}
            label={t(`entries.fields.${f.name}`)}
            optionLabel={(o) => t(`expenseCategories.${o}`)}
            suggestions={suggestions}
            today={today}
          />
        ))}
      </Card>

      {cfg.lineMode !== "none" && (
        <section aria-labelledby="lines-heading" className="space-y-3">
          <h2 id="lines-heading" className="text-lg font-semibold text-primary-800">
            {t("entries.lines")}
          </h2>
          {state.errors?.lines && <Notice tone="alert">{err("lines")}</Notice>}
          {lines.map((l, idx) => {
            const item = itemById.get(l.itemId);
            const unit = item ? t(`units.${item.unit}`) : "";
            const p = `lines.${idx}`;
            const avail = l.itemId ? available[l.itemId] ?? 0 : null;
            const showAvail = avail !== null && (cfg.lineMode === "inout" || cfg.lineMode === "out" || cfg.lineMode === "kind");
            return (
              <Card key={idx} className="grid gap-3 p-3 sm:grid-cols-12 sm:items-end sm:p-4">
                {cfg.lineMode === "kind" && (
                  <Field id={`${p}.kind`} label={t("entries.kind")} error={err(`${p}.kind`)} className="sm:col-span-3">
                    <Select id={`${p}.kind`} name={`${p}.kind`} value={l.kind} onChange={(e) => setLine(idx, { kind: e.target.value })}>
                      {cfg.kinds!.map((k) => (
                        <option key={k} value={k}>
                          {t(`kinds.${k}`)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                <Field
                  id={`${p}.itemId`}
                  label={t("entries.item")}
                  error={err(`${p}.itemId`)}
                  className={cfg.lineMode === "kind" ? "sm:col-span-4" : "sm:col-span-5"}
                >
                  <Select id={`${p}.itemId`} name={`${p}.itemId`} value={l.itemId} onChange={(e) => setLine(idx, { itemId: e.target.value })}>
                    <option value="">{t("entries.selectItem")}</option>
                    {grouped.map(([label, opts]) => (
                      <optgroup key={label} label={t(label)}>
                        {opts.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                  {showAvail && (
                    <p className="text-sm text-ink-muted">
                      {t("entries.available", { qty: `${fmtQty(avail!)} ${unit}` })}
                    </p>
                  )}
                </Field>

                {cfg.lineMode === "inout" ? (
                  <>
                    <QtyInput id={`${p}.inQty`} label={`${t("entries.inQty")} ${unit && `(${unit})`}`} value={l.inQty} onChange={(v) => setLine(idx, { inQty: v })} error={err(`${p}.inQty`)} />
                    <QtyInput id={`${p}.outQty`} label={`${t("entries.outQty")} ${unit && `(${unit})`}`} value={l.outQty} onChange={(v) => setLine(idx, { outQty: v })} error={err(`${p}.outQty`)} />
                  </>
                ) : (
                  <QtyInput id={`${p}.qty`} label={`${t("entries.qty")} ${unit && `(${unit})`}`} value={l.qty} onChange={(v) => setLine(idx, { qty: v })} error={err(`${p}.qty`)} />
                )}

                {cfg.lineExtras.includes("source") && (
                  <Field id={`${p}.source`} label={t("entries.source")} className="sm:col-span-3">
                    <Select id={`${p}.source`} name={`${p}.source`} value={l.source} onChange={(e) => setLine(idx, { source: e.target.value })}>
                      <option value="purchased">{t("sources.purchased")}</option>
                      <option value="donated">{t("sources.donated")}</option>
                    </Select>
                  </Field>
                )}
                {cfg.lineExtras.includes("donorName") && (l.source === "donated" || l.kind === "donation") && (
                  <Field id={`${p}.donorName`} label={t("entries.donorName")} className="sm:col-span-4">
                    <Input id={`${p}.donorName`} name={`${p}.donorName`} value={l.donorName} onChange={(e) => setLine(idx, { donorName: e.target.value })} />
                  </Field>
                )}
                {cfg.lineExtras.includes("rate") && l.kind === "purchase" && (
                  <QtyInput id={`${p}.rate`} label={t("entries.rate")} value={l.rate} onChange={(v) => setLine(idx, { rate: v })} error={err(`${p}.rate`)} />
                )}
                {cfg.lineExtras.includes("expiryDate") && l.kind !== "opening" && (
                  <Field id={`${p}.expiryDate`} label={`${t("entries.expiryDate")} (${t("common.optional")})`} className="sm:col-span-3">
                    <Input id={`${p}.expiryDate`} name={`${p}.expiryDate`} type="date" value={l.expiryDate} onChange={(e) => setLine(idx, { expiryDate: e.target.value })} />
                  </Field>
                )}
                {cfg.lineExtras.includes("acknowledged") && (
                  <label className="flex min-h-11 items-center gap-2 sm:col-span-3">
                    <input
                      type="checkbox"
                      name={`${p}.acknowledged`}
                      checked={l.acknowledged}
                      onChange={(e) => setLine(idx, { acknowledged: e.target.checked })}
                      className="size-5 accent-primary-600"
                    />
                    <span>{t("entries.acknowledged")}</span>
                  </label>
                )}
                {cfg.lineExtras.includes("note") && (
                  <Field id={`${p}.note`} label={`${t("entries.note")} (${t("common.optional")})`} className="sm:col-span-6">
                    <Input id={`${p}.note`} name={`${p}.note`} value={l.note} onChange={(e) => setLine(idx, { note: e.target.value })} />
                  </Field>
                )}
                <div className="sm:col-span-1 sm:text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setLines((ls) => (ls.length === 1 ? [emptyLine(cfg.kinds?.[0])] : ls.filter((_, i) => i !== idx)))}
                    aria-label={`${t("entries.removeLine")} ${idx + 1}`}
                  >
                    <Trash2 size={18} aria-hidden />
                  </Button>
                </div>
              </Card>
            );
          })}
          <Button type="button" variant="outline" onClick={() => setLines((ls) => [...ls, emptyLine(cfg.kinds?.[0])])}>
            <Plus size={18} aria-hidden />
            {t("entries.addLine")}
          </Button>
        </section>
      )}

      <Card>
        <Field id="remarks" label={`${t("entries.remarks")} (${t("common.optional")})`}>
          <Textarea id="remarks" name="remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </Field>
      </Card>

      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
        {pending ? t("common.saving") : submitLabel}
      </Button>
    </form>
  );
}

function QtyInput({ id, label, value, onChange, error }: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <Field id={id} label={label} error={error} className="sm:col-span-2">
      <Input id={id} name={id} type="number" inputMode="decimal" min={0} step="any" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={error ? true : undefined} />
    </Field>
  );
}

function HeaderInput({
  field,
  value,
  onChange,
  error,
  label,
  optionLabel,
  suggestions,
  today,
}: {
  field: HeaderField;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  label: string;
  optionLabel: (o: string) => string;
  suggestions: string[];
  today: string;
}) {
  const id = `fields.${field.name}`;
  const common = { id, name: id, value, required: field.required, "aria-invalid": error ? true : undefined } as const;
  return (
    <Field id={id} label={label} error={error} className={field.type === "textarea" ? "sm:col-span-2" : undefined}>
      {field.type === "textarea" ? (
        <>
          <Input {...common} list={`${id}-list`} onChange={(e) => onChange(e.target.value)} autoComplete="off" />
          {/* Past menus offered as suggestions (reusable menu templates). */}
          <datalist id={`${id}-list`}>
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </>
      ) : field.type === "select" ? (
        <Select {...common} onChange={(e) => onChange(e.target.value)}>
          <option value="" />
          {field.options!.map((o) => (
            <option key={o} value={o}>
              {optionLabel(o)}
            </option>
          ))}
        </Select>
      ) : (
        <Input
          {...common}
          type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
          inputMode={field.type === "number" ? "decimal" : undefined}
          min={field.type === "number" ? 0 : undefined}
          step={field.type === "number" ? "any" : undefined}
          max={field.type === "date" ? today : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}
