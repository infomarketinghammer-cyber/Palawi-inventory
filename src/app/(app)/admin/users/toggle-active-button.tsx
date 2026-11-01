"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setUserActive } from "./actions";

export function ToggleActiveButton({ userId, active, label }: { userId: string; active: boolean; label: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "outline" : "secondary"}
      disabled={pending}
      onClick={() => start(async () => void (await setUserActive(userId, !active)))}
    >
      {label}
    </Button>
  );
}
