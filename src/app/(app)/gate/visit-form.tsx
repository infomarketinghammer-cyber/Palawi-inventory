"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { DONATION_TYPES, PURPOSES } from "@/lib/gate";
import type { ItemOption } from "@/lib/ui-data";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, Notice } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useErrorText } from "@/components/use-error-text";
import { createVisitAction } from "./actions";

export function VisitForm({ items, today }: { items: ItemOption[]; today: string }) {
  const t = useTranslations();
  const errorText = useErrorText();
  const [state, action, pending] = useActionState(createVisitAction, { ok: false });
  // After a failed submit without JavaScript the page is re-rendered: start from the submitted values.
  const sent = state.values ?? {};
  const [v, setV] = useState({
    date: sent.date ?? today,
    time: sent.time ?? "",
    visitorName: sent.visitorName ?? "",
    dob: sent.dob ?? "",
    mobile: sent.mobile ?? "",
    address: sent.address ?? "",
    purpose: sent.purpose ?? "",
    extraRemark: sent.extraRemark ?? "",
  });
  const [don, setDon] = useState({ type: sent["donation.type"] ?? "", description: sent["donation.description"] ?? "", amount: sent["donation.amount"] ?? "" });
  const [goods, setGoods] = useState(() => {
    const rows = Object.keys(sent)
      .map((k) => k.match(/^donation\.lines\.(\d+)\.itemId$/)?.[1])
      .filter((i): i is string => i !== undefined)
      .map((i) => ({ itemId: sent[`donation.lines.${i}.itemId`] ?? "", qty: sent[`donation.lines.${i}.qty`] ?? "" }));
    return rows.length ? rows : [{ itemId: "", qty: "" }];
  });
  const err = (k: string) => errorText(state.errors?.[k]);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  const isDonation = v.purpose === "DONATION" || v.purpose === "FOOD_MEAL";
  const unitOf = (id: string) => items.find((i) => i.id === id)?.unit;

  return (
    <form action={action} className="space-y-6">
      {state.message && !state.ok && <Notice tone="alert">{errorText(state.message)}</Notice>}
      <Card className="grid gap-4 sm:grid-cols-2">
        <Field id="date" label={t("entries.date")} error={err("date")}>
          <Input id="date" name="date" type="date" max={today} required value={v.date} onChange={set("date")} />
        </Field>
        <Field id="time" label={`${t("gate.time")} (${t("common.optional")})`} error={err("time")}>
          <Input id="time" name="time" type="time" value={v.time} onChange={set("time")} />
        </Field>
        <Field id="visitorName" label={t("gate.visitorName")} error={err("visitorName")}>
          <Input id="visitorName" name="visitorName" required value={v.visitorName} onChange={set("visitorName")} autoComplete="off" />
        </Field>
        <Field id="mobile" label={`${t("gate.mobile")} (${t("common.optional")})`} error={err("mobile")}>
          <Input id="mobile" name="mobile" inputMode="tel" value={v.mobile} onChange={set("mobile")} autoComplete="off" />
        </Field>
        <Field id="dob" label={`${t("gate.dob")} (${t("common.optional")})`} error={err("dob")}>
          <Input id="dob" name="dob" type="date" max={today} value={v.dob} onChange={set("dob")} />
        </Field>
        <Field id="address" label={`${t("gate.address")} (${t("common.optional")})`} error={err("address")}>
          <Input id="address" name="address" value={v.address} onChange={set("address")} />
        </Field>
        <Field id="purpose" label={t("gate.purpose")} error={err("purpose")}>
          <Select id="purpose" name="purpose" required value={v.purpose} onChange={set("purpose")}>
            <option value="">{t("gate.selectPurpose")}</option>
            {PURPOSES.map((p) => (
              <option key={p} value={p}>
                {t(`gate.purposes.${p}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="extraRemark" label={`${t("gate.extraRemark")} (${t("common.optional")})`} error={err("extraRemark")}>
          <Input id="extraRemark" name="extraRemark" value={v.extraRemark} onChange={set("extraRemark")} />
        </Field>
      </Card>

      {isDonation && (
        <Card className="space-y-4">
          <CardTitle>{t("gate.donationSection")}</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="donation.type" label={t("gate.donationType")} error={err("donation.type")}>
              <Select id="donation.type" name="donation.type" required value={don.type} onChange={(e) => setDon((s) => ({ ...s, type: e.target.value }))}>
                <option value="" />
                {DONATION_TYPES.map((d) => (
                  <option key={d} value={d}>
                    {t(`donations.types.${d}`)}
                  </option>
                ))}
              </Select>
            </Field>
            {don.type === "CASH" && (
              <Field id="donation.amount" label={t("donations.amount")} error={err("donation.amount")}>
                <Input id="donation.amount" name="donation.amount" type="number" min={1} step="any" inputMode="decimal" required value={don.amount} onChange={(e) => setDon((s) => ({ ...s, amount: e.target.value }))} />
              </Field>
            )}
            <Field id="donation.description" label={t("donations.description")} className="sm:col-span-2">
              <Textarea id="donation.description" name="donation.description" value={don.description} onChange={(e) => setDon((s) => ({ ...s, description: e.target.value }))} />
            </Field>
          </div>
          {don.type && don.type !== "CASH" && (
            <fieldset className="space-y-3">
              <legend className="font-medium text-primary-800">{t("gate.goods")}</legend>
              {goods.map((g, i) => (
                <div key={i} className="grid gap-3 sm:grid-cols-12 sm:items-end">
                  <Field id={`donation.lines.${i}.itemId`} label={t("entries.item")} className="sm:col-span-7">
                    <Select
                      id={`donation.lines.${i}.itemId`}
                      name={`donation.lines.${i}.itemId`}
                      value={g.itemId}
                      onChange={(e) => setGoods((gs) => gs.map((x, j) => (j === i ? { ...x, itemId: e.target.value } : x)))}
                    >
                      <option value="">{t("entries.selectItem")}</option>
                      {items.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field id={`donation.lines.${i}.qty`} label={`${t("entries.qty")}${unitOf(g.itemId) ? ` (${t(`units.${unitOf(g.itemId)}`)})` : ""}`} className="sm:col-span-4">
                    <Input
                      id={`donation.lines.${i}.qty`}
                      name={`donation.lines.${i}.qty`}
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      value={g.qty}
                      onChange={(e) => setGoods((gs) => gs.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))}
                    />
                  </Field>
                  <div className="sm:col-span-1">
                    <Button type="button" variant="ghost" size="sm" aria-label={`${t("entries.removeLine")} ${i + 1}`} onClick={() => setGoods((gs) => (gs.length === 1 ? [{ itemId: "", qty: "" }] : gs.filter((_, j) => j !== i)))}>
                      <Trash2 size={18} aria-hidden />
                    </Button>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setGoods((gs) => [...gs, { itemId: "", qty: "" }])}>
                <Plus size={16} aria-hidden />
                {t("entries.addLine")}
              </Button>
            </fieldset>
          )}
        </Card>
      )}

      <Button type="submit" size="lg" loading={pending} className="w-full sm:w-auto">
        {pending ? t("common.saving") : t("common.save")}
      </Button>
    </form>
  );
}
