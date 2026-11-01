"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, Notice } from "@/components/ui/card";
import { TextField } from "@/components/text-field";
import { useErrorText } from "@/components/use-error-text";
import { changePassword } from "./actions";

export function PasswordForm() {
  const t = useTranslations();
  const errorText = useErrorText();
  const [state, action, pending] = useActionState(changePassword, { ok: false });

  return (
    <Card>
      <CardTitle className="mb-4">{t("settings.changePassword")}</CardTitle>
      {state.ok && state.message && <Notice>{errorText(state.message)}</Notice>}
      <form action={action} className="grid max-w-md gap-4">
        <TextField name="current" label={t("settings.currentPassword")} state={state} type="password" autoComplete="current-password" required />
        <TextField name="next" label={t("settings.newPassword")} state={state} type="password" autoComplete="new-password" required />
        <TextField name="confirm" label={t("settings.confirmPassword")} state={state} type="password" autoComplete="new-password" required />
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
