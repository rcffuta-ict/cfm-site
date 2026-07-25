"use client";

import * as React from "react";
import { cn } from "@/src/lib/utils";

/**
 * Material 3 *filled* text field.
 *
 * The signature Material input: a tonal container with a squared-off bottom, a
 * label that floats up into the field when it has focus or content, and an
 * active indicator underline that thickens and takes the primary colour on
 * focus. Implemented with a real <input> and a CSS-only float (`:placeholder-
 * shown`), so it needs no state wiring and keeps working with uncontrolled
 * forms — which is how the login form submits.
 */
export interface TextFieldProps
    extends Omit<React.ComponentProps<"input">, "placeholder"> {
    label: string;
    /** Helper or error copy shown beneath the field. */
    supportingText?: string;
    error?: boolean;
    /** Shown once the label has floated; keep it short. */
    placeholder?: string;
}

const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
    (
        {
            className,
            label,
            supportingText,
            error = false,
            id,
            placeholder = " ",
            ...props
        },
        ref
    ) => {
        const reactId = React.useId();
        const inputId = id ?? reactId;
        const describedBy = supportingText ? `${inputId}-support` : undefined;

        return (
            <div className={cn("w-full", className)}>
                <div className="group relative">
                    <input
                        id={inputId}
                        ref={ref}
                        placeholder={placeholder}
                        aria-invalid={error || undefined}
                        aria-describedby={describedBy}
                        className={cn(
                            "peer h-14 w-full rounded-t-xs bg-surface-container-highest px-4 pb-2 pt-6",
                            "text-base text-on-surface caret-primary outline-none",
                            "placeholder:text-transparent",
                            "transition-colors duration-200 ease-standard",
                            "hover:bg-surface-container-high",
                            "disabled:cursor-not-allowed disabled:opacity-40"
                        )}
                        {...props}
                    />

                    {/* Floating label: sits mid-field when empty, rises on focus
                        or once a value exists. */}
                    <label
                        htmlFor={inputId}
                        className={cn(
                            "pointer-events-none absolute left-4 top-2 origin-left",
                            "text-xs font-medium tracking-[0.03em]",
                            "transition-all duration-200 ease-standard",
                            error ? "text-error" : "text-on-surface-variant",
                            // Empty + unfocused → drop back down to the middle.
                            "peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base",
                            // Focused → rise again and take the accent colour.
                            "peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-xs",
                            error ? "peer-focus:text-error" : "peer-focus:text-primary"
                        )}
                    >
                        {label}
                    </label>

                    {/* Active indicator. */}
                    <span
                        aria-hidden="true"
                        className={cn(
                            "pointer-events-none absolute inset-x-0 bottom-0 h-px",
                            error ? "bg-error" : "bg-on-surface-variant"
                        )}
                    />
                    <span
                        aria-hidden="true"
                        className={cn(
                            "pointer-events-none absolute inset-x-0 bottom-0 h-0.5 scale-x-0",
                            "transition-transform duration-200 ease-standard",
                            "peer-focus:scale-x-100",
                            error ? "bg-error" : "bg-primary"
                        )}
                    />
                </div>

                {supportingText && (
                    <p
                        id={describedBy}
                        className={cn(
                            "mt-1.5 px-4 text-xs tracking-[0.03em]",
                            error ? "text-error" : "text-on-surface-variant"
                        )}
                    >
                        {supportingText}
                    </p>
                )}
            </div>
        );
    }
);
TextField.displayName = "TextField";

export { TextField };
