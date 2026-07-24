import { Moon } from "lucide-react";
import { IctLogo } from "./IctLogo";
import { CfmIcon } from "./Brand";
import { Ambient } from "./Ambient";

export default function EventClosed() {
    return (
        <div className="relative flex min-h-[100dvh] flex-col items-center justify-center p-6 text-center">
            <Ambient />

            <div className="flex w-full max-w-lg flex-col items-center rounded-[2rem] border border-border bg-card/60 p-10 shadow-glow backdrop-blur-xl md:p-12">
                <div className="group relative mb-8">
                    <div className="absolute -inset-2 rounded-full bg-brand-gradient opacity-40 blur-xl transition-transform duration-500 group-hover:scale-110" />
                    <div className="relative rounded-full border border-border bg-background p-5">
                        <CfmIcon width={64} height={64} />
                    </div>
                </div>

                <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-white/[0.04] px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    <Moon className="size-3.5" /> Currently offline
                </span>

                <h1 className="mb-4 text-3xl font-extrabold tracking-tight md:text-4xl">
                    Event <span className="text-gradient">Closed</span>
                </h1>

                <p className="mx-auto max-w-sm text-base leading-relaxed text-muted-foreground md:text-lg">
                    The doors aren&apos;t open rn. Hang tight — if you think
                    this is a mix-up, reach out to your level coordinator.
                </p>
            </div>

            <div className="mt-12 flex items-center gap-2 text-sm font-medium text-muted-foreground/70">
                <span>Powered by</span>
                <IctLogo variant="white" width={24} height={24} />
                <span>ICT Team</span>
            </div>
        </div>
    );
}
