"use client";

import { Printer } from "lucide-react";
import { Button } from "./ui/button";

export function PrintButton({ label }: { label: string }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
      <Printer size={16} aria-hidden />
      {label}
    </Button>
  );
}
