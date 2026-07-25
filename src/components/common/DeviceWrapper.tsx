"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { isTvRoute } from "@/src/lib/routes";

export default function DeviceWrapper({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const isWide = pathname?.startsWith("/admin");

    if (isTvRoute(pathname)) {
        // Full-bleed kiosk / projector display — the (tv-screens) layout owns
        // the chrome from here.
        return <div className="min-h-[100dvh] w-full">{children}</div>;
    }

    // Centred app column — wider for the admin console.
    return (
        <div
            className={`mx-auto w-full flex-1 px-4 sm:px-6 ${isWide ? "max-w-5xl" : "max-w-xl"}`}
        >
            {children}
        </div>
    );
}
