"use client";

import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "@/src/lib/utils";

/**
 * Material 3 switch.
 *
 * Material's switch is noticeably chunkier than the shadcn default (52×32 track)
 * and its thumb *grows* from 16px to 24px when it turns on — that size change is
 * the main "it moved" signal, alongside the track colour. Unselected uses an
 * outlined track so the off state stays visible on a dark surface.
 */
const Switch = React.forwardRef<
    React.ElementRef<typeof SwitchPrimitives.Root>,
    React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
    <SwitchPrimitives.Root
        className={cn(
            "peer inline-flex h-8 w-[52px] shrink-0 cursor-pointer items-center rounded-full border-2",
            "transition-colors duration-200 ease-standard",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
            "disabled:cursor-not-allowed disabled:opacity-40",
            "data-[state=checked]:border-primary data-[state=checked]:bg-primary",
            "data-[state=unchecked]:border-outline data-[state=unchecked]:bg-surface-container-highest",
            className
        )}
        {...props}
        ref={ref}
    >
        <SwitchPrimitives.Thumb
            className={cn(
                "pointer-events-none block rounded-full shadow-e-1 ring-0",
                "transition-all duration-200 ease-standard",
                "data-[state=checked]:h-6 data-[state=checked]:w-6 data-[state=checked]:translate-x-[22px] data-[state=checked]:bg-on-primary",
                "data-[state=unchecked]:h-4 data-[state=unchecked]:w-4 data-[state=unchecked]:translate-x-[6px] data-[state=unchecked]:bg-outline"
            )}
        />
    </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
