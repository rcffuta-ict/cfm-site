import type { ReactNode } from "react";
import { Ambient } from "@/src/components/common/Ambient";
import { IctLogo } from "@/src/components/common/IctLogo";

/**
 * Shared chrome for the screens shown on the church TVs.
 *
 * These run unattended on a projector or wall display, so the layout owns the
 * things every TV screen needs — the tonal backdrop and the ICT credit — and
 * suppresses the things that only make sense on a personal device (a mouse
 * cursor parked in the middle of the picture, accidental text selection, a
 * visible scrollbar). Individual TV pages are then free to be nothing but their
 * content.
 */
export default function TvScreensLayout({
    children,
}: {
    children: ReactNode;
}) {
    return (
        <div className="relative min-h-[100dvh] w-full cursor-none select-none [&::-webkit-scrollbar]:hidden">
            <Ambient />

            {children}

            <div className="pointer-events-none fixed bottom-6 right-6 z-30 opacity-80">
                <IctLogo width={80} height={22} />
            </div>
        </div>
    );
}
