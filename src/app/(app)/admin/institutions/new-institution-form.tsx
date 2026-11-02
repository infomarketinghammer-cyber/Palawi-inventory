"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, Notice } from "@/components/ui/card";
import { TextField } from "@/components/text-field";
import { useErrorText } from "@/components/use-error-text";
import { createInstitution } from "./actions";

export function NewInstitutionForm() {
  const t = useTranslations();
  const errorText = useErrorText();
  const [state, action, pending] = useActionState(createInstitution, { ok: false });
  const opt = (label: string) => `${label} (${t("common.optional")})`;

  return (
    <Card>
      <CardTitle className="mb-4">{t("institutions.add")}</CardTitle>
      {state.ok && state.message && <Notice>{errorText(state.message)}</Notice>}
      <form action={action} className="grid gap-4 sm:grid-cols-2">
        <TextField name="code" label={t("institutions.code")} hint={t("clients.codeHint")} state={state} required />
        <div className="hidden sm:block" />
        <TextField name="nameMr" label={t("institutions.nameMr")} state={state} required lang="mr" />
        <TextField name="nameEn" label={t("institutions.nameEn")} state={state} required lang="en" />
        <TextField name="cityMr" label={opt(t("institutions.cityMr"))} state={state} lang="mr" />
        <TextField name="cityEn" label={opt(t("institutions.cityEn"))} state={state} lang="en" />
        <TextField name="address" label={opt(t("institutions.address"))} state={state} className="sm:col-span-2" />
        <div className="sm:col-span-2">
          <Button type="submit" loading={pending}>
            {pending ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
