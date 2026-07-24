"use client";

import Link from "next/link";
import { Home } from "lucide-react";
import { Ambient } from "@/src/components/common/Ambient";
import { CfmIcon } from "@/src/components/common/Brand";
import { Button } from "@/src/components/ui/button";

export default function NotFoundPage() {
    return (
        <div className="relative flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
            <Ambient />

            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-white/[0.04] px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground animate-floaty">
                404 · it&apos;s giving lost 💀
            </span>

            <div className="flex items-end gap-2">
                <span className="text-[clamp(5rem,20vw,11rem)] font-black leading-none text-gradient">
                    4
                </span>
                <span className="relative animate-spin-slow">
                    <span className="absolute -inset-2 rounded-full opacity-40 blur-md ring-conic" />
                    <span className="relative rounded-full border border-border bg-background p-3">
                        <CfmIcon width={80} height={80} priority />
                    </span>
                </span>
                <span className="text-[clamp(5rem,20vw,11rem)] font-black leading-none text-gradient">
                    4
                </span>
            </div>

            <h1 className="mt-6 text-2xl font-extrabold tracking-tight">
                This page ghosted us 👻
            </h1>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                No cap — the link you followed isn&apos;t on the guest list.
                Let&apos;s get you back to the vibes.
            </p>

            <Button asChild variant="brand" size="lg" className="mt-8">
                <Link href="/">
                    <Home /> Take me home ✨
                </Link>
            </Button>
        </div>
    );
}
