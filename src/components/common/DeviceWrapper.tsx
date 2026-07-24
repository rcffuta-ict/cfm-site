"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";

export default function DeviceWrapper({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const isTvDisplay = pathname === "/oracle" || pathname === "/stats";
    const isWide = pathname?.startsWith("/admin");

    if (isTvDisplay) {
        // Full-bleed kiosk / projector display.
        return <div className="min-h-[100dvh] w-full">{children}</div>;
    }

    // Centered app column — wider for the admin console.
    return (
        <div
            className={`mx-auto w-full flex-1 px-4 sm:px-6 ${isWide ? "max-w-5xl" : "max-w-2xl"}`}
        >
            {children}
        </div>
    );
}
