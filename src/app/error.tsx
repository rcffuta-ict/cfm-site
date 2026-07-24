"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, Home, Zap } from "lucide-react";
import { Ambient } from "@/src/components/common/Ambient";
import { Button } from "@/src/components/ui/button";

export default function ErrorPage({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="relative flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
            <Ambient />

            <div className="animate-floaty rounded-3xl border border-border bg-card/60 p-5 backdrop-blur-xl">
                <Zap className="size-10 text-brand-amber" />
            </div>

            <p className="mt-6 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                well, that flopped
            </p>
            <h1 className="mt-2 text-[clamp(3rem,12vw,6rem)] font-black leading-none tracking-tight text-gradient">
                ERROR
            </h1>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Something went sideways on our end — not the vibe. Try again in a
                sec.
            </p>
            {error?.message && (
                <p className="mt-4 max-w-md break-words rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
                    {error.message}
                </p>
            )}

            <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button variant="brand" size="lg" onClick={reset}>
                    <RotateCcw /> Run it back
                </Button>
                <Button asChild variant="outline" size="lg">
                    <Link href="/">
                        <Home /> Go Home
                    </Link>
                </Button>
            </div>
        </div>
    );
}
