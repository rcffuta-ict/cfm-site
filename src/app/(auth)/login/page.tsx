"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { HelpCircle, LogIn } from "lucide-react";
import { loginAction } from "./actions";
import { useProfileStore } from "@/src/lib/stores/profile.store";
import { CfmLogo } from "@/src/components/common/Brand";
import { IctLogo } from "@/src/components/common/IctLogo";
import { Ambient } from "@/src/components/common/Ambient";
import { Button } from "@/src/components/ui/button";
import { TextField } from "@/src/components/ui/text-field";
import { Progress } from "@/src/components/ui/progress";
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

                toast.success("You're in", { id: toastId });
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
        <div className="relative flex min-h-[100dvh] flex-col items-center justify-center px-4 py-10">
            <Ambient />

            {/* The event wordmark is the hero — it identifies the app better
                than any heading we could set in type. */}
            <div className="mb-7 flex justify-center">
                <CfmLogo width={140} height={80} priority />
            </div>

            <div className="w-full max-w-md overflow-hidden rounded-xl bg-surface-container-low shadow-e-2">
                {/* Indeterminate progress doubles as the loading affordance,
                    pinned to the top edge of the card the Material way. */}
                <div className="h-1">
                    {isPending && <Progress thickness={4} className="rounded-none" />}
                </div>

                <div className="p-7 sm:p-8">
                    <h1 className="font-display text-2xl font-extrabold tracking-tight text-on-surface">
                        Sign in
                    </h1>
                    <p className="mt-1.5 text-sm leading-6 tracking-[0.016em] text-on-surface-variant">
                        Claim your Oracle ID for the Combined Family Meeting.
                    </p>

                    <form
                        onSubmit={handleSubmit}
                        className="mt-7 space-y-4"
                        autoComplete="one-time-code"
                    >
                        <TextField
                            id="identifier"
                            name="identifier"
                            label="Email or phone number"
                            placeholder="you@futa.edu.ng"
                            type="text"
                            autoComplete="one-time-code"
                            required
                            disabled={isPending}
                            error={Boolean(error)}
                            data-lpignore="true"
                            data-1p-ignore="true"
                        />

                        <TextField
                            id="token"
                            name="token"
                            label="Level invite token"
                            supportingText={
                                error || "From your level coordinator"
                            }
                            error={Boolean(error)}
                            type="text"
                            autoComplete="one-time-code"
                            required
                            disabled={isPending}
                            data-lpignore="true"
                            data-1p-ignore="true"
                        />

                        <Button
                            type="submit"
                            variant="filled"
                            size="lg"
                            className="w-full"
                            disabled={isPending}
                        >
                            <LogIn /> {isPending ? "Signing in…" : "Sign in"}
                        </Button>

                        <Button
                            type="button"
                            variant="text"
                            size="default"
                            className="w-full"
                            onClick={() => setShowGuide(true)}
                        >
                            <HelpCircle /> How it works
                        </Button>
                    </form>
                </div>

                <div className="border-t border-outline-variant bg-surface-container px-7 py-4">
                    <p className="text-center text-xs leading-5 tracking-[0.03em] text-on-surface-variant">
                        For RCF FUTA members, 100L–500L. Not on the list? Talk to
                        your level coordinator.
                    </p>
                </div>
            </div>

            <div className="mt-9 flex items-center gap-2.5">
                <span className="text-xs tracking-[0.03em] text-on-surface-variant">
                    Powered by
                </span>
                <IctLogo asLink width={68} height={22} />
            </div>

            <LoginGuideModal
                isOpen={showGuide}
                onClose={() => setShowGuide(false)}
            />
        </div>
    );
}
