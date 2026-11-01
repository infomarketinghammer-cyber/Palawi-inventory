import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-card border border-primary-100 bg-white p-4 shadow-sm sm:p-6", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-lg font-semibold text-primary-800", className)} {...props} />;
}

export function PageHeader({ title, intro, children }: { title: string; intro?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-primary-800">{title}</h1>
        {intro && <p className="mt-1 max-w-2xl text-ink-muted">{intro}</p>}
      </div>
      {children}
    </div>
  );
}

/** Status pill. Status is always conveyed by icon + text, never colour alone. */
export function Badge({
  tone = "neutral",
  icon,
  children,
}: {
  tone?: "neutral" | "ok" | "pending" | "alert";
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const tones = {
    neutral: "bg-primary-50 text-primary-800 border-primary-200",
    ok: "bg-secondary-100 text-secondary-800 border-secondary-300",
    pending: "bg-primary-100 text-primary-900 border-primary-300 border-dashed",
    alert: "bg-alert-50 text-alert-700 border-alert-600",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm font-medium", tones[tone])}>
      {icon}
      {children}
    </span>
  );
}

export function Notice({ tone = "ok", children }: { tone?: "ok" | "alert"; children: React.ReactNode }) {
  return (
    <div
      role={tone === "alert" ? "alert" : "status"}
      className={cn(
        "mb-4 rounded-xl border px-4 py-3",
        tone === "alert" ? "border-alert-600 bg-alert-50 text-alert-700" : "border-secondary-300 bg-secondary-50 text-secondary-900",
      )}
    >
      {children}
    </div>
  );
}
