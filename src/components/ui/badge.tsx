import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/src/lib/utils";

const badgeVariants = cva(
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
    {
        variants: {
            variant: {
                default: "border-transparent bg-primary/15 text-primary-foreground",
                brand: "border-white/10 bg-brand-gradient text-white",
                secondary: "border-transparent bg-secondary/20 text-secondary-foreground",
                accent: "border-accent/30 bg-accent/15 text-accent",
                mint: "border-brand-mint/30 bg-brand-mint/15 text-brand-mint",
                outline: "border-border text-foreground bg-white/[0.03]",
                destructive:
                    "border-destructive/30 bg-destructive/15 text-destructive",
            },
        },
        defaultVariants: { variant: "default" },
    }
);

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    );
}

export { Badge, badgeVariants };
