"use client";

import type { ActionState } from "@/lib/validation";
import { Field, Input } from "./ui/form";
import { useErrorText } from "./use-error-text";

/** Labelled input wired to an action's state: shows its field error and keeps the submitted value. */
export function TextField({
  name,
  label,
  hint,
  state,
  ...props
}: { name: string; label: string; hint?: string; state?: ActionState } & React.InputHTMLAttributes<HTMLInputElement>) {
  const errorText = useErrorText();
  const id = name.replace(/\./g, "-");
  const error = errorText(state?.errors?.[name]);
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <Input
        id={id}
        name={name}
        defaultValue={state?.ok ? undefined : state?.values?.[name]}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...props}
      />
    </Field>
  );
}
