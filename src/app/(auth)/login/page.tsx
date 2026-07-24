"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { loginAction } from "./actions";
import { useProfileStore } from "@/src/lib/stores/profile.store";
import Image from "next/image";
import { LoginGuideModal } from "./LoginGuideModal";

export default function LoginPage() {
    const router = useRouter();
    const { setSession, session } = useProfileStore();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState("");
    const [showGuide, setShowGuide] = useState(false);
    // const [showToken, setShowToken] = useState(false);

    // If the client-side store already has a valid session, go to dashboard
    useEffect(() => {
        if (session?.raffleId) {
            router.replace("/");
        }
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
                    toast.error(result.error ?? "Login failed", {
                        id: toastId,
                    });
                    setError(result.error ?? "Login failed");
                    return;
                }

                console.debug("User data", result);

                toast.success("Welcome! 🎉", { id: toastId });
                setSession({
                    profile: result.data.profile,
                    raffleId: result.data.raffleId,
                    eventTitle: result.data.eventTitle,
                    eventDate: result.data.eventDate,
                });
                router.push("/");
            })();
        });
    }

    return (
        <div className="login-page">
            <div className="login-glow login-glow--purple" />
            <div className="login-glow login-glow--blue" />

            <div className="login-card">
                <div className="login-logo max-w-5xl flex justify-center">
                    <Image
                        src="/logo/cfm-logo.png"
                        alt="RCF FUTA"
                        width={150}
                        height={150}
                    />
                </div>

                <h1 className="login-title">Combined Family Meeting</h1>
                <p className="login-subtitle mb-2">
                    Sign in to get your Oracle ID
                </p>

                <div className="flex justify-center mb-6">
                    <button
                        type="button"
                        onClick={() => setShowGuide(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white/90 rounded-full text-sm font-medium transition-colors border border-white/10 backdrop-blur-sm"
                    >
                        <span>ℹ️</span> How it works
                    </button>
                </div>

                {/* Added autoComplete="off" at the form level */}
                <form
                    onSubmit={handleSubmit}
                    className="login-form"
                    autoComplete="one-time-code"
                >
                    <div className="login-field">
                        <label htmlFor="identifier">
                            Email or Phone Number
                        </label>
                        <input
                            id="identifier"
                            name="identifier"
                            type="text"
                            autoComplete="one-time-code"
                            placeholder="e.g. you@futa.edu.ng or 08012345678"
                            required
                            disabled={isPending}
                            data-lpignore="true"
                            data-1p-ignore="true"
                        />
                    </div>

                    <div className="login-field relative group">
                        <label htmlFor="token">Level Invite Token</label>
                        <div className="relative">
                            <input
                                id="token"
                                name="token"
                                type={"text"}
                                autoComplete="one-time-code"
                                placeholder="Token from your level rep"
                                required
                                disabled={isPending}
                                className="w-full pr-10"
                                data-lpignore="true"
                                data-1p-ignore="true"
                            />
                        </div>
                    </div>

                    {error && <p className="login-error">{error}</p>}

                    <button
                        type="submit"
                        className="login-btn"
                        disabled={isPending}
                    >
                        {isPending ? (
                            <span className="login-btn__spinner" />
                        ) : (
                            "Sign In"
                        )}
                    </button>
                </form>

                <p className="login-footer">
                    Only for RCF FUTA members (100L–500L). <br />
                    Contact ICT if you have issues signing in.
                </p>
            </div>

            <LoginGuideModal
                isOpen={showGuide}
                onClose={() => setShowGuide(false)}
            />
        </div>
    );
}
