import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/src/lib/utils";

/**
 * Material 3 cards. The three Material kinds:
 *
 *  - `elevated` — a lifted surface (tonal step + shadow). The default.
 *  - `filled`   — the highest tonal container, no shadow. Good for grouping.
 *  - `outlined` — flat, defined by an outline. Lowest emphasis.
 *
 * Note there is no backdrop blur anywhere: in Material, depth is a tonal step,
 * so a card is legible on any background without needing to frost it.
 */
const cardVariants = cva("rounded-lg text-on-surface", {
    variants: {
        variant: {
            elevated: "bg-surface-container-low shadow-e-1",
            filled: "bg-surface-container-highest",
            outlined: "border border-outline-variant bg-surface",
        },
    },
    defaultVariants: { variant: "elevated" },
});

export interface CardProps
    extends React.HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
    ({ className, variant, ...props }, ref) => (
        <div
            ref={ref}
            className={cn(cardVariants({ variant }), className)}
            {...props}
        />
    )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex flex-col gap-1 p-5", className)}
        {...props}
    />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        /* M3 title-large */
        className={cn("text-[1.375rem] font-bold leading-7", className)}
        {...props}
    />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        /* M3 body-medium */
        className={cn(
            "text-sm leading-5 tracking-[0.016em] text-on-surface-variant",
            className
        )}
        {...props}
    />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex items-center gap-2 p-5 pt-0", className)}
        {...props}
    />
));
CardFooter.displayName = "CardFooter";

export {
    Card,
    CardHeader,
    CardFooter,
    CardTitle,
    CardDescription,
    CardContent,
    cardVariants,
};
