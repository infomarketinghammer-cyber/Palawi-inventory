"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, Notice } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/form";
import { TextField } from "@/components/text-field";
import { useErrorText } from "@/components/use-error-text";
import { createUser } from "./actions";

export function NewUserForm({ institutions }: { institutions: { id: string; name: string }[] }) {
  const t = useTranslations();
  const errorText = useErrorText();
  const [state, action, pending] = useActionState(createUser, { ok: false });
  const v = state.ok ? undefined : state.values;

  return (
    <Card>
      <CardTitle className="mb-4">{t("users.add")}</CardTitle>
      {state.ok && state.message && <Notice>{errorText(state.message)}</Notice>}
      <form action={action} className="grid gap-4 sm:grid-cols-2">
        <TextField name="name" label={t("users.name")} state={state} required />
        <TextField name="phone" label={t("users.phone")} state={state} inputMode="tel" autoComplete="off" />
        <TextField name="email" label={`${t("users.email")} (${t("common.optional")})`} state={state} type="email" autoComplete="off" />
        <TextField
          name="password"
          label={t("users.password")}
          hint={t("users.passwordHint")}
          state={state}
          type="password"
          autoComplete="new-password"
          required
        />

        <Field id="role" label={t("users.role")} error={errorText(state.errors?.role)}>
          <Select id="role" name="role" defaultValue={v?.role ?? "STORE_USER"} key={`role-${v?.role}`}>
            <option value="STORE_USER">{t("roles.STORE_USER")}</option>
            <option value="ADMIN">{t("roles.ADMIN")}</option>
          </Select>
        </Field>
        <Field id="institutionId" label={t("users.institution")} error={errorText(state.errors?.institutionId)}>
          <Select id="institutionId" name="institutionId" defaultValue={v?.institutionId ?? institutions[0]?.id ?? ""} key={`inst-${v?.institutionId}`}>
            <option value="">{t("users.allInstitutions")}</option>
            {institutions.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </Select>
        </Field>

        <dl className="space-y-2 rounded-xl bg-surface p-3 text-sm sm:col-span-2">
          {(["STORE_USER", "ADMIN"] as const).map((r) => (
            <div key={r}>
              <dt className="font-semibold text-primary-800">{t(`roles.${r}`)}</dt>
              <dd className="text-ink-muted">{t(`users.roleHelp.${r}`)}</dd>
            </div>
          ))}
        </dl>

        <div className="sm:col-span-2">
          <Button type="submit" loading={pending}>
            {pending ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
