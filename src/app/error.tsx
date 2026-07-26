"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, Home, TriangleAlert } from "lucide-react";
import { Ambient } from "@/src/components/common/Ambient";
import { CfmIcon } from "@/src/components/common/Brand";
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
        <div className="relative flex min-h-[100dvh] flex-col items-center justify-center px-6 py-12 text-center">
            <Ambient />

            <div className="flex items-center align-center gap-6 mt-7 ">
                <CfmIcon width={56} height={56} priority />

                <span className="grid h-14 w-14 place-items-center rounded-full bg-error-container text-on-error-container">
                    <TriangleAlert className="size-7" />
                </span>
            </div>

            <h1 className="mt-5 font-display text-2xl font-extrabold tracking-tight text-on-surface">
                Something went wrong
            </h1>
            <p className="mt-2 max-w-sm text-sm leading-6 tracking-[0.016em] text-on-surface-variant">
                An unexpected error occurred on our end. Try again in a moment.
            </p>

            {error?.message && (
                <p className="mt-5 max-w-md break-words rounded-md bg-error-container/50 px-4 py-3 text-left text-xs leading-5 text-on-error-container">
                    {error.message}
                </p>
            )}

            <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button variant="filled" size="lg" onClick={reset}>
                    <RotateCcw /> Try again
                </Button>
                <Button asChild variant="outlined" size="lg">
                    <Link href="/">
                        <Home /> Go home
                    </Link>
                </Button>
            </div>
        </div>
    );
}
