"use client";

import { useEffect } from "react";
import { IctLogo } from "@/src/components/common/IctLogo";

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export function LoginGuideModal({ isOpen, onClose }: Props) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div
                className="login-card max-w-lg w-full relative animate-in fade-in zoom-in-95 duration-200"
                style={{ margin: 0 }}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>

                <div className="flex flex-col items-center text-center space-y-4 mb-6">
                    <IctLogo variant="white" width={100} />
                    <h2 className="text-2xl font-bold text-white mt-4">
                        How It Works
                    </h2>
                </div>

                <div className="space-y-4 text-white/80 text-sm leading-relaxed">
                    <p>
                        Welcome! To get your Raffle ID, sign in using your{" "}
                        <strong>Email or Phone number</strong> and the{" "}
                        <strong>Level Invite Token</strong> shared by your{" "}
                        <strong>Level Coordinator</strong>.
                    </p>
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-left">
                        <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                            <span>🔒</span> How your level is verified
                        </h3>
                        <p>
                            Each level has its own invite token. Signing in with
                            your level&apos;s token confirms which level you
                            belong to, so the Oracle selection stays fair and
                            only RCF FUTA members take part.
                        </p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-left space-y-3 mt-4">
                        <h3 className="font-semibold text-white flex items-center gap-2">
                            <span>⚠️</span> Important Requirements
                        </h3>
                        <ul className="list-disc pl-5 space-y-2 text-white/90">
                            <li>
                                Use the email or phone number registered with
                                RCF FUTA.
                            </li>
                            <li>
                                Get the correct{" "}
                                <strong>Level Invite Token</strong> from your
                                level coordinator.
                            </li>
                        </ul>
                        <p className="text-sm mt-3 text-red-300">
                            <i>
                                Don&apos;t have an account or token? Reach out to
                                your <b>Level Coordinator</b> or the ICT team.
                            </i>
                        </p>
                    </div>
                </div>

                <button onClick={onClose} className="login-btn mt-6">
                    Got it, let's sign in!
                </button>
            </div>
        </div>
    );
}
