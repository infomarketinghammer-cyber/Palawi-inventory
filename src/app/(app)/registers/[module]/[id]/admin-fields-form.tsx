"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/card";
import { useErrorText } from "@/components/use-error-text";

/** Admin-only header fields (medical officer verification) recorded on an entry at any status. */
export function AdminFieldsForm({
  action,
  hidden,
  fields,
  submitLabel,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  hidden: Record<string, string>;
  fields: { name: string; type: string; label: string; value: string }[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { ok: false });
  const errorText = useErrorText();
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {state.message && (
        <div className="sm:col-span-2">
          <Notice tone={state.ok ? "ok" : "alert"}>{errorText(state.message)}</Notice>
        </div>
      )}
      {fields.map((f) => (
        <Field key={f.name} id={`af-${f.name}`} label={f.label}>
          <Input id={`af-${f.name}`} name={`fields.${f.name}`} type={f.type === "date" ? "date" : "text"} defaultValue={f.value} />
        </Field>
      ))}
      <div className="sm:col-span-2">
        <Button type="submit" variant="secondary" loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
