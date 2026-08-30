import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[60px] w-full rounded-lg border border-input bg-white dark:bg-white/[0.05] px-3 py-2 text-sm text-foreground dark:text-white/90 shadow-sm transition-colors resize-none",
          "placeholder:text-muted-foreground dark:placeholder:text-white/25",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring",
          "dark:border-white/[0.1] dark:focus-visible:border-blue-500/70 dark:focus-visible:ring-blue-500/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
