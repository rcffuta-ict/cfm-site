"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Sparkles, Info, LogIn } from "lucide-react";
import { loginAction } from "./actions";
import { useProfileStore } from "@/src/lib/stores/profile.store";
import { CfmLogo } from "@/src/components/common/Brand";
import { Ambient } from "@/src/components/common/Ambient";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { LoginGuideModal } from "./LoginGuideModal";

export default function LoginPage() {
    const router = useRouter();
    const { setSession, session } = useProfileStore();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState("");
    const [showGuide, setShowGuide] = useState(false);

    useEffect(() => {
        if (session?.raffleId) router.replace("/");
    }, [session, router]);

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");
        const formData = new FormData(e.currentTarget);

        startTransition(() => {
            (async () => {
                const toastId = toast.loading("Signing you in…");
                const result = await loginAction(formData);

                if (!result.success || !result.data) {
                    toast.error(result.error ?? "Login failed", { id: toastId });
                    setError(result.error ?? "Login failed");
                    return;
                }

                toast.success("You're in! 🎉", { id: toastId });
                setSession({
                    profile: result.data.profile,
                    raffleId: result.data.raffleId,
                    eventTitle: result.data.eventTitle,
                    eventDate: result.data.eventDate,
                    isAdmin: result.data.isAdmin,
                });
                router.push("/");
            })();
        });
    }

    return (
        <div className="relative flex min-h-[100dvh] items-center justify-center px-4 py-10">
            <Ambient />

            <div className="w-full max-w-md rounded-3xl border border-border bg-card/70 p-8 shadow-glow backdrop-blur-xl animate-in fade-in zoom-in-95 duration-500 sm:p-10">
                <div className="mb-5 flex justify-center">
                    <div className="relative">
                        <div className="absolute -inset-3 rounded-full bg-brand-gradient opacity-30 blur-xl" />
                        <div className="relative rounded-2xl border border-border bg-background/60 p-3">
                            <CfmLogo width={120} height={120} priority />
                        </div>
                    </div>
                </div>

                <h1 className="text-center text-2xl font-extrabold tracking-tight">
                    Combined <span className="text-gradient">Family Meeting</span>
                </h1>
                <p className="mt-1 text-center text-sm text-muted-foreground">
                    Sign in and lock in your Oracle ID 🔒
                </p>

                <div className="mt-5 flex justify-center">
                    <Button
                        type="button"
                        variant="glass"
                        size="sm"
                        onClick={() => setShowGuide(true)}
                    >
                        <Info /> How it works
                    </Button>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="mt-7 space-y-5"
                    autoComplete="one-time-code"
                >
                    <div className="space-y-2">
                        <Label htmlFor="identifier">Email or Phone Number</Label>
                        <Input
                            id="identifier"
                            name="identifier"
                            type="text"
                            autoComplete="one-time-code"
                            placeholder="you@futa.edu.ng or 08012345678"
                            required
                            disabled={isPending}
                            data-lpignore="true"
                            data-1p-ignore="true"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="token">Level Invite Token</Label>
                        <Input
                            id="token"
                            name="token"
                            type="text"
                            autoComplete="one-time-code"
                            placeholder="Token from your level rep"
                            required
                            disabled={isPending}
                            data-lpignore="true"
                            data-1p-ignore="true"
                        />
                    </div>

                    {error && (
                        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                            {error}
                        </p>
                    )}

                    <Button
                        type="submit"
                        variant="brand"
                        size="lg"
                        className="w-full"
                        disabled={isPending}
                    >
                        {isPending ? (
                            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        ) : (
                            <>
                                <LogIn /> Sign In
                            </>
                        )}
                    </Button>
                </form>

                <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
                    For RCF FUTA fam only (100L–500L). <br />
                    Not on the list? Slide into your level coordinator&apos;s DMs.
                </p>
            </div>

            <div className="pointer-events-none absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-1.5 text-xs text-muted-foreground/70">
                <Sparkles className="size-3.5" /> Powered by RCF FUTA ICT
            </div>

            <LoginGuideModal
                isOpen={showGuide}
                onClose={() => setShowGuide(false)}
            />
        </div>
    );
}
