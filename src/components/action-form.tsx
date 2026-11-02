"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/validation";
import { Button } from "./ui/button";
import { Field, Input } from "./ui/form";
import { Notice } from "./ui/card";
import { useErrorText } from "./use-error-text";

/**
 * A one-button form for a server action (approve, reject, unlock, delete...).
 * Optional reason input: always shown (`reason`), or only after a failure that asks for one (`reasonOnError`).
 */
export function ActionForm({
  action,
  hidden,
  label,
  variant = "primary",
  reason,
  reasonOnError,
  className,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  hidden: Record<string, string>;
  label: string;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  reason?: { name: string; label: string; required?: boolean };
  reasonOnError?: { name: string; label: string; whenMessage: string };
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, { ok: false });
  const errorText = useErrorText();
  const showErrorReason = reasonOnError && !state.ok && state.message === reasonOnError.whenMessage;
  const id = `${label}-${Object.values(hidden).join("-")}`.replace(/\W+/g, "-");

  return (
    <form action={formAction} className={className ?? "space-y-2"}>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {state.message && (
        <Notice tone={state.ok ? "ok" : "alert"}>
          <p>{errorText(state.message)}</p>
        </Notice>
      )}
      {state.details && (
        <Notice tone={state.ok ? "ok" : "alert"}>
          <ul className="list-disc pl-5">
            {state.details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </Notice>
      )}
      {reason && (
        <Field id={`${id}-r`} label={reason.label} error={errorText(state.errors?.reason)}>
          <Input id={`${id}-r`} name={reason.name} required={reason.required} />
        </Field>
      )}
      {showErrorReason && (
        <Field id={`${id}-o`} label={reasonOnError.label}>
          <Input id={`${id}-o`} name={reasonOnError.name} required />
        </Field>
      )}
      <Button type="submit" variant={variant} loading={pending}>
        {label}
      </Button>
    </form>
  );
}
