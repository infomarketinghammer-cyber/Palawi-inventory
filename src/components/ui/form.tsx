import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block text-sm font-medium text-ink", className)} {...props} />;
}

const fieldClass =
  "block w-full min-h-11 rounded-xl border border-primary-200 bg-white px-3 py-2 text-base text-ink placeholder:text-ink-muted/70 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 aria-[invalid=true]:border-alert-600";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClass, className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldClass, "pr-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldClass, "min-h-20", className)} {...props} />;
}

/** Label + control + hint + error, wired up with ids for screen readers. */
export function Field({
  id,
  label,
  hint,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-alert-700">
          {error}
        </p>
      )}
    </div>
  );
}
