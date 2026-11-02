"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { CATEGORIES, UNITS, VEG_GROUPS } from "@/lib/modules";
import type { ActionState } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/form";
import { TextField } from "@/components/text-field";
import { useErrorText } from "@/components/use-error-text";

export type ItemValues = Partial<Record<"code" | "nameMr" | "nameEn" | "category" | "group" | "unit" | "reorderLevel" | "perChildDailyNorm" | "location", string>> & { trackExpiry?: boolean };

export function ItemForm({ action, initial }: { action: (p: ActionState, fd: FormData) => Promise<ActionState>; initial?: ItemValues }) {
  const t = useTranslations();
  const errorText = useErrorText();
  const [state, formAction, pending] = useActionState(action, { ok: false });
  const v = { ...initial, ...(state.ok ? {} : state.values) } as ItemValues;
  const [category, setCategory] = useState(v.category ?? "GRAIN");
  const s = { ...state, values: v as Record<string, string> };
  const opt = (l: string) => `${l} (${t("common.optional")})`;

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      {state.message && (
        <div className="sm:col-span-2">
          <Notice tone={state.ok ? "ok" : "alert"}>{errorText(state.message)}</Notice>
        </div>
      )}
      <TextField name="code" label={t("items.code")} hint={t("clients.codeHint")} state={s} required />
      <Field id="category" label={t("items.category")} error={errorText(state.errors?.category)}>
        <Select id="category" name="category" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`categories.${c}`)}
            </option>
          ))}
        </Select>
      </Field>
      <TextField name="nameMr" label={t("items.nameMr")} state={s} required lang="mr" />
      <TextField name="nameEn" label={t("items.nameEn")} state={s} required lang="en" />
      {category === "VEGETABLE" && (
        <Field id="group" label={t("items.group")}>
          <Select id="group" name="group" defaultValue={v.group ?? "FRUIT_VEG"}>
            {VEG_GROUPS.map((g) => (
              <option key={g} value={g}>
                {t(`vegGroups.${g}`)}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field id="unit" label={t("items.unit")} error={errorText(state.errors?.unit)}>
        <Select id="unit" name="unit" defaultValue={v.unit ?? "kg"} key={`unit-${v.unit}`}>
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {t(`units.${u}`)}
            </option>
          ))}
        </Select>
      </Field>
      <TextField name="reorderLevel" label={opt(t("items.reorderLevel"))} state={s} type="number" min={0} step="any" inputMode="decimal" />
      <TextField name="perChildDailyNorm" label={opt(t("items.perChildDailyNorm"))} state={s} type="number" min={0} step="any" inputMode="decimal" />
      <TextField name="location" label={opt(t("items.location"))} state={s} />
      <label className="flex min-h-11 items-center gap-2">
        <input type="checkbox" name="trackExpiry" defaultChecked={initial?.trackExpiry} className="size-5 accent-primary-600" />
        <span>{t("items.trackExpiry")}</span>
      </label>
      <div className="sm:col-span-2">
        <Button type="submit" loading={pending}>
          {pending ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </form>
  );
}
