"use client";

import { X, Lock, TriangleAlert } from "lucide-react";
import { IctLogo } from "@/src/components/common/IctLogo";
import { Button } from "@/src/components/ui/button";

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export function LoginGuideModal({ isOpen, onClose }: Props) {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-lg rounded-3xl border border-border bg-card/90 p-8 shadow-glow backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Close"
                >
                    <X className="size-5" />
                </button>

                <div className="mb-6 flex flex-col items-center space-y-3 text-center">
                    <IctLogo variant="white" width={100} />
                    <h2 className="text-2xl font-bold">How It Works</h2>
                </div>

                <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                    <p>
                        To grab your Oracle ID, sign in with your{" "}
                        <strong className="text-foreground">
                            Email or Phone number
                        </strong>{" "}
                        and the{" "}
                        <strong className="text-foreground">
                            Level Invite Token
                        </strong>{" "}
                        from your{" "}
                        <strong className="text-foreground">
                            Level Coordinator
                        </strong>
                        .
                    </p>

                    <div className="rounded-2xl border border-border bg-white/[0.03] p-4 text-left">
                        <h3 className="mb-2 flex items-center gap-2 font-semibold text-foreground">
                            <Lock className="size-4 text-accent" /> How your level
                            is verified
                        </h3>
                        <p>
                            Each level has its own invite token. Signing in with
                            your level&apos;s token confirms which level you
                            belong to — so the Oracle stays fair and no cap.
                        </p>
                    </div>

                    <div className="space-y-3 rounded-2xl border border-border bg-white/[0.03] p-4 text-left">
                        <h3 className="flex items-center gap-2 font-semibold text-foreground">
                            <TriangleAlert className="size-4 text-brand-amber" />{" "}
                            Before you start
                        </h3>
                        <ul className="list-disc space-y-2 pl-5 text-foreground/90">
                            <li>
                                Use the email or phone registered with RCF FUTA.
                            </li>
                            <li>
                                Get the correct{" "}
                                <strong>Level Invite Token</strong> from your
                                level coordinator.
                            </li>
                        </ul>
                        <p className="text-destructive">
                            No account or token? Reach out to your{" "}
                            <b>Level Coordinator</b> or the ICT team.
                        </p>
                    </div>
                </div>

                <Button
                    variant="brand"
                    size="lg"
                    className="mt-6 w-full"
                    onClick={onClose}
                >
                    Got it, let&apos;s go ✨
                </Button>
            </div>
        </div>
    );
}
