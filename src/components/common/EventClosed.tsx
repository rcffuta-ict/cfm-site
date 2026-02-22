"use client";

import React from "react";
import Image from "next/image";
import { IctLogo } from "./IctLogo";

export default function EventClosed() {
    return (
        <div className="min-h-[100dvh] bg-[#0A1028] flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
            {/* Ambient glows */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#2D6ADE] rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-pulse" />
            <div
                className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#BD24DF] rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-pulse"
                style={{ animationDelay: "1.5s" }}
            />

            <div className="relative z-10 flex flex-col items-center max-w-lg w-full">
                <div className="bg-white/5 border border-white/10 p-10 md:p-12 rounded-[2rem] backdrop-blur-xl shadow-2xl flex flex-col items-center w-full">
                    <div className="mb-8 relative group">
                        <div className="absolute inset-0 bg-white/20 rounded-full blur-xl scale-110 group-hover:scale-125 transition-transform duration-500" />
                        <div className="relative bg-[#0A1028] border border-white/20 p-5 rounded-full shadow-xl">
                            <Image
                                src="/images/Logo/logo.png"
                                alt="RCF FUTA"
                                width={64}
                                height={64}
                                className="object-contain"
                            />
                        </div>
                    </div>

                    <h1 className="text-3xl md:text-4xl font-extrabold mb-4 text-white tracking-tight">
                        Event <span className="text-gradient">Closed</span>
                    </h1>

                    <p className="text-white/70 text-base md:text-lg mb-8 leading-relaxed max-w-sm mx-auto">
                        This event is currently not active. If you believe this
                        is a mistake, please reach out to your level
                        coordinator.
                    </p>

                    <a
                        href="https://ict.rcffuta.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl font-medium text-white transition-all duration-300 w-full sm:w-auto"
                    >
                        <span>Visit ICT Portal</span>
                        <svg
                            className="w-4 h-4 text-white/50 group-hover:text-white transition-colors group-hover:translate-x-1"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M14 5l7 7m0 0l-7 7m7-7H3"
                            />
                        </svg>
                    </a>
                </div>
            </div>

            <div className="mt-12 relative z-10 flex items-center gap-2 text-white/40 text-sm font-medium">
                <span>Powered by</span>
                {/* <Image
                    src="/images/Logo/logo.png"
                    alt="RCF FUTA"
                    width={20}
                    height={20}
                    className="opacity-40 grayscale"
                /> */}
                <IctLogo variant="white" width={24} height={24} />
                <span>ICT Team</span>
            </div>
        </div>
    );
}
