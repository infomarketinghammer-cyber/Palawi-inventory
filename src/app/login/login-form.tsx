"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/card";
import { useErrorText } from "@/components/use-error-text";
import { login } from "./actions";

export function LoginForm() {
  const t = useTranslations("login");
  const errorText = useErrorText();
  const [state, action, pending] = useActionState(login, { ok: false });
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="space-y-4">
      {state.message && <Notice tone="alert">{errorText(state.message)}</Notice>}
      <Field id="identifier" label={t("identifier")}>
        <Input id="identifier" name="identifier" autoComplete="username" inputMode="email" required />
      </Field>
      <Field id="password" label={t("password")}>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            className="pr-12"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-muted"
            aria-label={show ? t("hidePassword") : t("showPassword")}
          >
            {show ? <EyeOff size={20} aria-hidden /> : <Eye size={20} aria-hidden />}
          </button>
        </div>
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {t("submit")}
      </Button>
    </form>
  );
}
