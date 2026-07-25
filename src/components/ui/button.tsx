import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/src/lib/utils";

/**
 * Material 3 common buttons.
 *
 * The five Material variants in order of emphasis: filled → tonal → elevated →
 * outlined → text. Hover and press feedback comes from the shared `.state-layer`
 * wash (a translucent veil of the button's own content colour) rather than from
 * brightness or glow, which is what makes the set feel Material rather than neon.
 */
const buttonVariants = cva(
    [
        "state-layer relative inline-flex items-center justify-center gap-2 whitespace-nowrap",
        "rounded-full font-semibold tracking-[0.01em] select-none",
        "transition-[background-color,box-shadow,color] duration-200 ease-standard",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        "disabled:pointer-events-none disabled:opacity-40",
        "[&_svg]:pointer-events-none [&_svg]:size-[18px] [&_svg]:shrink-0",
    ].join(" "),
    {
        variants: {
            variant: {
                filled: "bg-primary text-on-primary",
                tonal: "bg-secondary-container text-on-secondary-container",
                elevated:
                    "bg-surface-container-low text-primary shadow-e-1 hover:shadow-e-2",
                outlined:
                    "border border-outline bg-transparent text-primary",
                text: "bg-transparent text-primary",
                /* The lightning-bolt yellow — reserved for the single most
                   important action on a screen (the Oracle roll). */
                tertiary: "bg-tertiary text-on-tertiary",
                danger: "bg-error-container text-on-error-container",
            },
            size: {
                sm: "h-9 px-4 text-[0.8125rem]",
                default: "h-10 px-6 text-sm",
                lg: "h-12 px-8 text-[0.9375rem]",
                xl: "h-14 px-10 text-base [&_svg]:size-5",
                icon: "h-10 w-10 p-0",
            },
        },
        compoundVariants: [
            /* Text buttons sit tighter to their edges — M3 gives them less
               horizontal padding since they have no container. */
            { variant: "text", size: "default", class: "px-3" },
            { variant: "text", size: "sm", class: "px-2" },
            { variant: "text", size: "lg", class: "px-4" },
        ],
        defaultVariants: { variant: "filled", size: "default" },
    }
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button";
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        );
    }
);
Button.displayName = "Button";

export { Button, buttonVariants };
