import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Bricolage_Grotesque } from "next/font/google";
import { Toaster } from "react-hot-toast";
import DeviceWrapper from "@/src/components/common/DeviceWrapper";
import EventClosed from "@/src/components/common/EventClosed";
import Footer from "@/src/components/common/Footer";
import PreviewBanner from "@/src/components/common/PreviewBanner";
import { getAdminClient } from "@/src/lib/supabase/server";
import { isEventLive } from "@/src/lib/event";
import "./globals.css";

/* Self-hosted at build time by next/font — no render-blocking request to
   Google, and no layout shift while the face loads. */
const sans = Plus_Jakarta_Sans({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-sans",
});

/* Reserved for headlines and the big Oracle numerals — it carries the chunky
   energy of the CFM logo without shouting in body copy. */
const display = Bricolage_Grotesque({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-display",
});

export const metadata: Metadata = {
    title: "Combined Family Meeting — Redeemed Christian Fellowship FUTA Chapter",
    description: "Powered by RCF FUTA ICT",
};

export const viewport: Viewport = {
    // Matches --surface, so the mobile browser chrome blends into the app.
    themeColor: "#191825",
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
        <html
            lang="en"
            className={`dark ${sans.variable} ${display.variable}`}
        >
            <body>
                {/* Outside the live/closed branch on purpose — a preview of the
                    closed state still needs to announce that it's a preview. */}
                <PreviewBanner />

                {!isLive ? (
                    <EventClosed />
                ) : (
                    <div className="flex min-h-[100dvh] flex-col">
                        <DeviceWrapper>{children}</DeviceWrapper>
                        <Footer />
                    </div>
                )}

                {/* Material snackbar: inverse surface, low radius, elevation 3. */}
                <Toaster
                    position="bottom-center"
                    toastOptions={{
                        style: {
                            background: "hsl(var(--inverse-surface))",
                            color: "hsl(var(--inverse-on-surface))",
                            border: "none",
                            borderRadius: "8px",
                            padding: "14px 16px",
                            fontSize: "14px",
                            fontWeight: 500,
                            boxShadow:
                                "0 1px 3px 0 rgb(0 0 0 / 0.30), 0 4px 8px 3px rgb(0 0 0 / 0.15)",
                        },
                        success: {
                            iconTheme: {
                                primary: "hsl(var(--success-container))",
                                secondary: "hsl(var(--on-success-container))",
                            },
                        },
                        error: {
                            iconTheme: {
                                primary: "hsl(var(--error-container))",
                                secondary: "hsl(var(--on-error-container))",
                            },
                        },
                    }}
                />
            </body>
        </html>
    );
}
