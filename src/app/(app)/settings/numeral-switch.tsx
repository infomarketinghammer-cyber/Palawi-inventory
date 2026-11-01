"use client";

import { useTransition } from "react";
import { setNumerals } from "@/app/actions";
import { cn } from "@/lib/utils";

export function NumeralSwitch({
  current,
  latinLabel,
  devaLabel,
  groupLabel,
}: {
  current: "latin" | "deva";
  latinLabel: string;
  devaLabel: string;
  groupLabel: string;
}) {
  const [pending, start] = useTransition();
  const options = [
    { value: "latin", label: latinLabel },
    { value: "deva", label: devaLabel },
  ] as const;
  return (
    <div role="group" aria-label={groupLabel} className="inline-flex rounded-full border border-primary-200 bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={current === o.value}
          disabled={pending}
          onClick={() => start(() => setNumerals(o.value))}
          className={cn(
            "min-h-9 rounded-full px-4 text-sm font-medium",
            current === o.value ? "bg-primary-600 text-white" : "text-primary-800 hover:bg-primary-50",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
