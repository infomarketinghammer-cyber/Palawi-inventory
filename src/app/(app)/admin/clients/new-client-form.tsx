"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, Notice } from "@/components/ui/card";
import { TextField } from "@/components/text-field";
import { useErrorText } from "@/components/use-error-text";
import { createClient } from "./actions";

export function NewClientForm() {
  const t = useTranslations();
  const errorText = useErrorText();
  const [state, action, pending] = useActionState(createClient, { ok: false });

  return (
    <Card>
      <CardTitle className="mb-4">{t("clients.add")}</CardTitle>
      {state.ok && state.message && <Notice>{errorText(state.message)}</Notice>}
      <form action={action} className="space-y-6">
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <TextField name="client.code" label={t("clients.code")} hint={t("clients.codeHint")} state={state} required autoCapitalize="characters" />
          <div className="hidden sm:block" />
          <TextField name="client.nameMr" label={t("clients.nameMr")} state={state} required lang="mr" />
          <TextField name="client.nameEn" label={t("clients.nameEn")} state={state} required lang="en" />
          <TextField name="client.taglineMr" label={`${t("clients.taglineMr")} (${t("common.optional")})`} state={state} lang="mr" />
          <TextField name="client.taglineEn" label={`${t("clients.taglineEn")} (${t("common.optional")})`} state={state} lang="en" />
        </fieldset>

        <fieldset className="grid gap-4 border-t border-primary-100 pt-4 sm:grid-cols-2">
          <legend className="mb-2 font-semibold text-primary-800">{t("clients.firstInstitution")}</legend>
          <TextField name="institution.code" label={t("institutions.code")} hint={t("clients.codeHint")} state={state} required />
          <div className="hidden sm:block" />
          <TextField name="institution.nameMr" label={t("institutions.nameMr")} state={state} required lang="mr" />
          <TextField name="institution.nameEn" label={t("institutions.nameEn")} state={state} required lang="en" />
          <TextField name="institution.cityMr" label={`${t("institutions.cityMr")} (${t("common.optional")})`} state={state} lang="mr" />
          <TextField name="institution.cityEn" label={`${t("institutions.cityEn")} (${t("common.optional")})`} state={state} lang="en" />
        </fieldset>

        <fieldset className="grid gap-4 border-t border-primary-100 pt-4 sm:grid-cols-2">
          <legend className="mb-2 font-semibold text-primary-800">{t("clients.firstAdmin")}</legend>
          <TextField name="admin.name" label={t("users.name")} state={state} required />
          <TextField name="admin.phone" label={t("users.phone")} state={state} inputMode="tel" autoComplete="off" />
          <TextField name="admin.email" label={t("users.email")} state={state} type="email" autoComplete="off" />
          <TextField
            name="admin.password"
            label={t("users.password")}
            hint={t("users.passwordHint")}
            state={state}
            type="password"
            autoComplete="new-password"
            required
          />
        </fieldset>

        <Button type="submit" disabled={pending}>
          {pending ? t("common.saving") : t("common.save")}
        </Button>
      </form>
    </Card>
  );
}
