"use client";

import { usePathname } from "next/navigation";
import { IctLogo } from "./IctLogo";

export default function Footer() {
    const pathname = usePathname();

    // Do not show footer on the full-screen TV displays
    if (pathname?.startsWith("/oracle") || pathname === "/stats") {
        return null;
    }

    return (
        <footer className="relative z-40 mt-auto w-full border-t border-border bg-background/80 px-6 py-4 backdrop-blur-md">
            <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-4 text-sm text-muted-foreground sm:flex-row sm:justify-between">
                <p>Courtesy of Level Coordinators</p>
                <div className="flex items-center gap-2">
                    <span>Powered by RCF FUTA ICT Team</span>
                    {/* <Image
                        src="/logo/cfm-icon.png"
                        alt="RCF FUTA"
                        width={24}
                        height={24}
                        className="opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-300"
                    /> */}

                    <IctLogo variant="white" width={24} height={24} />
                </div>
            </div>
        </footer>
    );
}
