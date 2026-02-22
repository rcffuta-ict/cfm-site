"use client";

import { usePathname } from "next/navigation";
import Image from "next/image";
import { IctLogo } from "./IctLogo";

export default function Footer() {
    const pathname = usePathname();

    // Do not show footer on oracle pages
    if (pathname?.startsWith("/oracle")) {
        return null;
    }

    return (
        <footer className="w-full py-4 px-6 mt-auto border-t border-white/5 bg-[#0A1028]/80 backdrop-blur-md z-40 relative">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-center sm:justify-between items-center gap-4 text-white/50 text-sm">
                <p>Courtesy of Level Coordinators</p>
                <div className="flex items-center gap-2">
                    <span>Powered by RCF FUTA ICT Team</span>
                    {/* <Image
                        src="/images/Logo/logo.png"
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
