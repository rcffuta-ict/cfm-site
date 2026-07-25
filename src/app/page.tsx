"use client";

import { useEffect, useState } from "react";
import { useProfileStore } from "@/src/lib/stores/profile.store";
import StoreInitializer from "@/src/components/common/StoreInitializer";
import UserDashboard from "@/src/components/UserDashboard";
import { CfmIcon } from "@/src/components/common/Brand";
import { Ambient } from "@/src/components/common/Ambient";
import { Progress } from "@/src/components/ui/progress";

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
                    <CfmIcon width={64} height={64} priority />
                    <div className="w-44">
                        <Progress />
                    </div>
                    <p className="text-sm tracking-[0.016em] text-on-surface-variant">
                        Loading your dashboard…
                    </p>
                </div>
            ) : (
                <UserDashboard />
            )}
        </>
    );
}
