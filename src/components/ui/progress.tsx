import * as React from "react";
import { cn } from "@/src/lib/utils";

/**
 * Material 3 linear progress indicator.
 *
 * Omit `value` for the indeterminate form (a bar sweeping a tonal track) — this
 * is what Material uses in place of a spinner for "something is happening but we
 * can't say how far along". Pass `value` (0–100) for the determinate form, which
 * the stats screen uses for its level bars.
 */
export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
    value?: number;
    /** Track thickness in px. M3 default is 4. */
    thickness?: number;
    indicatorClassName?: string;
}

export function Progress({
    value,
    thickness = 4,
    className,
    indicatorClassName,
    ...props
}: ProgressProps) {
    const indeterminate = value === undefined;
    const clamped = indeterminate
        ? 0
        : Math.max(0, Math.min(100, Math.round(value)));

    return (
        <div
            role="progressbar"
            aria-valuemin={indeterminate ? undefined : 0}
            aria-valuemax={indeterminate ? undefined : 100}
            aria-valuenow={indeterminate ? undefined : clamped}
            className={cn(
                "relative w-full overflow-hidden rounded-full bg-surface-container-highest",
                className
            )}
            style={{ height: thickness }}
            {...props}
        >
            <div
                className={cn(
                    "h-full rounded-full bg-primary",
                    indeterminate
                        ? "w-full animate-progress-indeterminate"
                        : "transition-[width] duration-700 ease-standard",
                    indicatorClassName
                )}
                style={indeterminate ? undefined : { width: `${clamped}%` }}
            />
        </div>
    );
}
