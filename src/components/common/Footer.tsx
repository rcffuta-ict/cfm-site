"use client";

import { usePathname } from "next/navigation";
import { IctLogo } from "./IctLogo";
import { isTvRoute } from "@/src/lib/routes";

export default function Footer() {
    const pathname = usePathname();

    // The TV screens carry their own ICT credit instead of a footer.
    if (isTvRoute(pathname)) {
        return null;
    }

    return (
        <footer className="mt-auto w-full border-t border-outline-variant bg-surface-container-lowest px-6 py-5">
            <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
                <p className="text-xs tracking-[0.03em] text-on-surface-variant">
                    Courtesy of the Level Coordinators
                </p>
                <div className="flex items-center gap-2.5">
                    <span className="text-xs tracking-[0.03em] text-on-surface-variant">
                        Powered by
                    </span>
                    <IctLogo asLink width={78} height={28} />
                </div>
            </div>
        </footer>
    );
}
