"use client";

import { useEffect, useState } from "react";
import { useProfileStore } from "@/src/lib/stores/profile.store";
import StoreInitializer from "@/src/components/common/StoreInitializer";
import UserDashboard from "@/src/components/UserDashboard";
import { CfmIcon } from "@/src/components/common/Brand";
import { Ambient } from "@/src/components/common/Ambient";

export default function HomePage() {
    const [mounted, setMounted] = useState(false);
    const session = useProfileStore((state) => state.session);
    const isLoading = useProfileStore((state) => state.isLoading);

    // Wait for Zustand to rehydrate from localStorage before first render
    useEffect(() => {
        setMounted(true);
    }, []);

    // Always mount StoreInitializer so it can verify / redirect
    return (
        <>
            <StoreInitializer />

            {!mounted || isLoading || !session ? (
                <div className="relative flex min-h-[100dvh] flex-col items-center justify-center gap-6">
                    <Ambient />
                    <div className="relative">
                        <div className="absolute -inset-4 animate-spin-slow rounded-full opacity-40 blur-lg ring-conic" />
                        <div className="relative rounded-3xl border border-border bg-background/70 p-4 animate-floaty">
                            <CfmIcon width={72} height={72} priority />
                        </div>
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                        Loading your dashboard…
                    </p>
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-primary" />
                </div>
            ) : (
                <UserDashboard />
            )}
        </>
    );
}
