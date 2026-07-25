"use client";

import { useEffect, useRef } from "react";
import { X, Lock, TriangleAlert, KeyRound } from "lucide-react";
import { CfmIcon } from "@/src/components/common/Brand";
import { Button } from "@/src/components/ui/button";

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Material 3 basic dialog: a high tonal container at elevation 3 over a scrim.
 * Dismissible by scrim click and by Escape, with focus moved into the dialog on
 * open so keyboard and screen-reader users aren't left behind on the page.
 */
export function LoginGuideModal({ isOpen, onClose }: Props) {
    const closeRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        closeRef.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="guide-title"
                className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-xl bg-surface-container-high p-6 shadow-e-3 animate-in fade-in zoom-in-95 duration-200 sm:p-8"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    ref={closeRef}
                    onClick={onClose}
                    className="state-layer absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full text-on-surface-variant"
                    aria-label="Close"
                >
                    <X className="size-5" />
                </button>

                <div className="flex flex-col items-center gap-4 text-center">
                    <CfmIcon width={48} height={48} />
                    <h2
                        id="guide-title"
                        className="font-display text-2xl font-extrabold tracking-tight text-on-surface"
                    >
                        How it works
                    </h2>
                </div>

                <p className="mt-5 text-sm leading-6 tracking-[0.016em] text-on-surface-variant">
                    To get your Oracle ID, sign in with the{" "}
                    <strong className="font-semibold text-on-surface">
                        email or phone number
                    </strong>{" "}
                    registered with RCF FUTA, plus the{" "}
                    <strong className="font-semibold text-on-surface">
                        level invite token
                    </strong>{" "}
                    from your level coordinator.
                </p>

                <div className="mt-5 space-y-3">
                    <section className="rounded-md bg-secondary-container/40 p-4">
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                            <Lock className="size-4 text-secondary" />
                            How your level is verified
                        </h3>
                        <p className="mt-1.5 text-sm leading-6 text-on-surface-variant">
                            Every level has its own invite token. Signing in with
                            your level&apos;s token confirms which level you
                            belong to, so the Oracle draw stays fair.
                        </p>
                    </section>

                    <section className="rounded-md bg-surface-container-highest p-4">
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                            <TriangleAlert className="size-4 text-tertiary" />
                            Before you start
                        </h3>
                        <ul className="mt-2 space-y-2 text-sm leading-6 text-on-surface-variant">
                            <li className="flex gap-2.5">
                                <KeyRound className="mt-1 size-3.5 shrink-0 text-on-surface-variant" />
                                Use the email or phone registered with RCF FUTA.
                            </li>
                            <li className="flex gap-2.5">
                                <KeyRound className="mt-1 size-3.5 shrink-0 text-on-surface-variant" />
                                Get the correct level invite token from your
                                coordinator.
                            </li>
                        </ul>
                    </section>

                    <p className="rounded-md bg-error-container/50 px-4 py-3 text-sm leading-6 text-on-error-container">
                        No account or token? Reach out to your level coordinator
                        or the ICT team.
                    </p>
                </div>

                <Button
                    variant="filled"
                    size="lg"
                    className="mt-6 w-full"
                    onClick={onClose}
                >
                    Got it
                </Button>
            </div>
        </div>
    );
}
