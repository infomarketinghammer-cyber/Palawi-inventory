import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-base font-medium text-center transition-colors disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        primary: "bg-primary-600 text-white hover:bg-primary-700",
        secondary: "bg-secondary-200 text-ink hover:bg-secondary-300",
        outline: "border border-primary-300 bg-white text-primary-800 hover:bg-primary-50",
        ghost: "text-primary-800 hover:bg-primary-100",
        danger: "bg-alert-600 text-white hover:bg-alert-700",
      },
      size: {
        md: "",
        sm: "min-h-9 rounded-lg px-3 py-1 text-sm",
        lg: "min-h-12 px-6 text-lg",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
