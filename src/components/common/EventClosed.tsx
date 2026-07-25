import { MoonStar } from "lucide-react";
import { IctLogo } from "./IctLogo";
import { CfmLogo } from "./Brand";
import { Ambient } from "./Ambient";
import { Chip } from "@/src/components/ui/chip";

export default function EventClosed() {
    return (
        <div className="relative flex min-h-[100dvh] flex-col items-center justify-center px-6 py-12">
            <Ambient />

            <div className="w-full max-w-md rounded-xl bg-surface-container-low p-8 text-center shadow-e-2 sm:p-10">
                <div className="flex justify-center">
                    <CfmLogo width={230} height={115} priority />
                </div>

                <div className="mt-7 flex justify-center">
                    <Chip variant="neutral">
                        <MoonStar /> Currently offline
                    </Chip>
                </div>

                <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-on-surface">
                    The doors are closed
                </h1>

                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 tracking-[0.016em] text-on-surface-variant">
                    Registration isn&apos;t open right now. Hang tight — if you
                    think this is a mix-up, reach out to your level coordinator.
                </p>
            </div>

            <div className="mt-10 flex items-center gap-2.5">
                <span className="text-xs tracking-[0.03em] text-on-surface-variant">
                    Powered by
                </span>
                <IctLogo asLink width={68} height={22} />
            </div>
        </div>
    );
}
