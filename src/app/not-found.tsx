"use client";

import Link from "next/link";
import { Home, Compass } from "lucide-react";
import { Ambient } from "@/src/components/common/Ambient";
import { CfmIcon } from "@/src/components/common/Brand";
import { Button } from "@/src/components/ui/button";
import { Chip } from "@/src/components/ui/chip";

export default function NotFoundPage() {
    return (
        <div className="relative flex min-h-[100dvh] flex-col items-center justify-center px-6 py-12 text-center">
            <Ambient />

            <CfmIcon width={56} height={56} priority />

            <div className="mt-7">
                <Chip variant="neutral">
                    <Compass /> Page not found
                </Chip>
            </div>

            <p className="mt-6 font-display text-[clamp(4rem,18vw,8rem)] font-extrabold leading-none tracking-tight text-primary">
                404
            </p>

            <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-on-surface">
                We can&apos;t find that page
            </h1>
            <p className="mt-2 max-w-sm text-sm leading-6 tracking-[0.016em] text-on-surface-variant">
                The link you followed may be broken, or the page may have moved.
            </p>

            <Button asChild variant="filled" size="lg" className="mt-8">
                <Link href="/">
                    <Home /> Back to home
                </Link>
            </Button>
        </div>
    );
}
