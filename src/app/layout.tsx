import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import DeviceWrapper from "@/src/components/common/DeviceWrapper";
import EventClosed from "@/src/components/common/EventClosed";
import Footer from "@/src/components/common/Footer";
import { getAdminClient } from "@/src/lib/supabase/server";
import { isEventLive } from "@/src/lib/event";
import "./globals.css";

export const metadata: Metadata = {
    title: "Combined Family Meeting — Redeemed Christian Fellowship FUTA Chapter",
    description: "Powered by RCF FUTA ICT",
};

// The live / not-live switch (event.is_active) is evaluated per request, so the
// app reflects it without a redeploy — never statically frozen at build time.
export const dynamic = "force-dynamic";

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // ── Live / not-live switch: the configured event's is_active flag ────────
    const isLive = await isEventLive(getAdminClient());

    return (
        <html lang="en" className="dark">
            <body>
                {!isLive ? (
                    <EventClosed />
                ) : (
                    <div className="flex min-h-[100dvh] flex-col">
                        <DeviceWrapper>{children}</DeviceWrapper>
                        <Footer />
                    </div>
                )}
                <Toaster
                    position="top-right"
                    toastOptions={{
                        style: {
                            background: "rgba(10, 16, 40, 0.9)",
                            color: "#ECF2FF",
                            border: "1px solid rgba(189, 36, 223, 0.3)",
                            borderRadius: "12px",
                            padding: "12px 16px",
                            fontSize: "15px",
                            backdropFilter: "blur(12px)",
                            fontFamily: "'Outfit', sans-serif",
                        },
                        success: {
                            iconTheme: {
                                primary: "#2D6ADE",
                                secondary: "#fff",
                            },
                        },
                        error: {
                            iconTheme: {
                                primary: "#BD24DF",
                                secondary: "#fff",
                            },
                        },
                    }}
                />
            </body>
        </html>
    );
}
