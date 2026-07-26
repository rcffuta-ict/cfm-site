"use client";

import * as React from "react";
import { cn } from "@/src/lib/utils";

/**
 * Material 3 primary tabs.
 *
 * Built for the admin's phone first: the strip scrolls horizontally rather than
 * wrapping or shrinking labels to nothing, and each tab is a full 48px touch
 * target. The active tab scrolls itself into view, so switching tabs never
 * leaves the current one off-screen.
 */
export interface TabItem {
    id: string;
    label: string;
    icon?: React.ReactNode;
    /** Small count or status shown after the label. */
    badge?: React.ReactNode;
}

export function Tabs({
    items,
    value,
    onChange,
    className,
}: {
    items: TabItem[];
    value: string;
    onChange: (id: string) => void;
    className?: string;
}) {
    const ref = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const active = ref.current?.querySelector<HTMLElement>(
            '[data-active="true"]'
        );
        active?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }, [value]);

    return (
        <div
            ref={ref}
            role="tablist"
            className={cn(
                "sticky top-0 z-20 -mx-4 flex overflow-x-auto border-b border-outline-variant bg-surface px-4 sm:-mx-6 sm:px-6",
                "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                className
            )}
        >
            {items.map((item) => {
                const active = item.id === value;
                return (
                    <button
                        key={item.id}
                        role="tab"
                        type="button"
                        aria-selected={active}
                        data-active={active}
                        onClick={() => onChange(item.id)}
                        className={cn(
                            "state-layer relative flex h-12 shrink-0 items-center gap-2 px-4",
                            "text-sm font-semibold tracking-[0.01em] whitespace-nowrap",
                            "transition-colors duration-200 ease-standard",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                            active
                                ? "text-primary"
                                : "text-on-surface-variant hover:text-on-surface"
                        )}
                    >
                        {item.icon}
                        {item.label}
                        {item.badge}
                        {/* Active indicator: a 3px bar with a rounded top edge. */}
                        <span
                            aria-hidden="true"
                            className={cn(
                                "absolute inset-x-2 bottom-0 h-[3px] rounded-t-full transition-opacity duration-200",
                                active ? "bg-primary opacity-100" : "opacity-0"
                            )}
                        />
                    </button>
                );
            })}
        </div>
    );
}

export function TabPanel({
    active,
    children,
}: {
    active: boolean;
    children: React.ReactNode;
}) {
    if (!active) return null;
    return (
        <div role="tabpanel" className="animate-in fade-in duration-200">
            {children}
        </div>
    );
}
