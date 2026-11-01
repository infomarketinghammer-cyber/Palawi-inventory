"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { useErrorText } from "@/components/use-error-text";
import { uploadGateAction } from "./actions";

export function UploadForm() {
  const t = useTranslations("imports");
  const errorText = useErrorText();
  const [state, action, pending] = useActionState(uploadGateAction, { ok: false });
  return (
    <form action={action} className="space-y-3">
      {state.message && <Notice tone="alert">{errorText(state.message)}</Notice>}
      <Field id="file" label={t("file")}>
        <Input id="file" name="file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required className="py-1.5" />
      </Field>
      <Button type="submit" disabled={pending}>
        <Upload size={18} aria-hidden />
        {pending ? "…" : t("upload")}
      </Button>
    </form>
  );
}
