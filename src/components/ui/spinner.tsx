import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Spinning loader with a visible label; announced to screen readers. */
export function Spinner({ label, className }: { label: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn("flex items-center justify-center gap-3 py-10 text-primary-800", className)}>
      <Loader2 size={28} aria-hidden className="animate-spin text-primary-600" />
      <span className="font-medium">{label}</span>
    </div>
  );
}

/** Page-level loading: a thin bar at the top of the window plus the spinner. */
export function PageLoading({ label }: { label: string }) {
  return (
    <>
      <div aria-hidden className="fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-primary-100 print:hidden">
        <div className="page-progress h-full w-2/5 rounded-full bg-primary-600" />
      </div>
      <Spinner label={label} className="min-h-[40vh]" />
    </>
  );
}
