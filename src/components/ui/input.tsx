import * as React from "react";
import { cn } from "@/src/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
    ({ className, type, ...props }, ref) => {
        return (
            <input
                type={type}
                ref={ref}
                className={cn(
                    "flex h-12 w-full rounded-xl border border-input bg-white/[0.03] px-4 py-2 text-base text-foreground transition-colors",
                    "placeholder:text-muted-foreground/70",
                    "focus-visible:outline-none focus-visible:border-primary/70 focus-visible:ring-2 focus-visible:ring-ring/40",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    className
                )}
                {...props}
            />
        );
    }
);
Input.displayName = "Input";

export { Input };
