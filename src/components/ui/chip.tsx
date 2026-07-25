import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/src/lib/utils";

/**
 * Material 3 chip — the compact, 8px-radius container Material uses for
 * attributes and filters. This replaces the pill "badge" the old theme used:
 * chips are squarer than pills, which is a big part of why a Material layout
 * reads as structured rather than bubbly.
 *
 * The tonal variants pair each container colour with its matching `on-` colour,
 * so contrast holds without any per-use tuning.
 */
const chipVariants = cva(
    "flex items-center gap-1.5 rounded-sm font-medium leading-none tracking-[0.01em] [&_svg]:size-[1.05em] [&_svg]:shrink-0 py-5",
    {
        variants: {
            variant: {
                outlined:
                    "border border-outline bg-transparent text-on-surface-variant",
                neutral: "bg-surface-container-highest text-on-surface-variant",
                primary: "bg-primary-container text-on-primary-container",
                secondary:
                    "bg-secondary-container text-on-secondary-container",
                tertiary: "bg-tertiary-container text-on-tertiary-container",
                success: "bg-success-container text-on-success-container",
                error: "bg-error-container text-on-error-container",
            },
            size: {
                sm: "h-6 px-2 text-[0.6875rem]",
                default: "h-8 px-3 text-[0.8125rem]",
                lg: "h-10 px-4 text-sm",
                /* Legible from across a hall. */
                tv: "h-[clamp(2.2rem,4vw,3.4rem)] rounded-md px-[clamp(0.9rem,1.6vw,1.6rem)] text-[clamp(0.9rem,1.7vw,1.5rem)]",
            },
        },
        defaultVariants: { variant: "neutral", size: "default" },
    }
);

export interface ChipProps
    extends React.HTMLAttributes<HTMLSpanElement>,
        VariantProps<typeof chipVariants> {}

function Chip({ className, variant, size, ...props }: ChipProps) {
    return (
        <span
            className={cn(chipVariants({ variant, size }), className)}
            {...props}
        />
    );
}

export { Chip, chipVariants };
