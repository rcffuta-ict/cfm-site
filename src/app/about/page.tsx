import { CalendarDays, MapPin, Info, ArrowLeft, BookOpen } from "lucide-react";
import { getAdminClient } from "@/src/lib/supabase/server";
import { getCfmEvent, CFM_EVENT_SLUG } from "@/src/lib/event";
import { Ambient } from "@/src/components/common/Ambient";
import { CfmIcon } from "@/src/components/common/Brand";
import { Button } from "@/src/components/ui/button";
import { Chip } from "@/src/components/ui/chip";

/**
 * About this event.
 *
 * Everything on the page comes from the single `events` row this deployment is
 * bound to (`CFM_EVENT_SLUG`), so updating the copy is a database edit rather
 * than a redeploy — the same principle as the live/not-live switch.
 */
export const dynamic = "force-dynamic";

export const metadata = {
    title: "About — Combined Family Meeting",
};

export default async function AboutPage() {
    const event = await getCfmEvent(getAdminClient());

    const formattedDate = event?.date
        ? new Date(event.date).toLocaleDateString("en-NG", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
          })
        : null;

    // Optional extras, if whoever manages the event has put them in config.
    const config = (event?.config ?? {}) as {
        venue?: string;
        time?: string;
        about?: string;
    };

    return (
        <div className="relative min-h-[100dvh] py-6">
            <Ambient />

            <header className="mb-5 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <CfmIcon width={32} height={32} priority />
                    <h1 className="truncate font-display text-lg font-extrabold tracking-tight text-on-surface">
                        About
                    </h1>
                </div>
                <Button asChild variant="text" size="sm">
                    <a href="/">
                        <ArrowLeft /> Dashboard
                    </a>
                </Button>
            </header>

            <main className="space-y-4">
                <section className="rounded-xl bg-primary-container p-6 text-on-primary-container shadow-e-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">
                        {event?.is_active ? "Happening now" : "Combined Family Meeting"}
                    </p>
                    <h2 className="mt-2 font-display text-2xl font-extrabold leading-tight">
                        {event?.title || "Combined Family Meeting"}
                    </h2>
                    {formattedDate && (
                        <p className="mt-3 flex items-center gap-2 text-sm font-semibold">
                            <CalendarDays className="size-4 shrink-0" />
                            {formattedDate}
                            {config.time ? ` · ${config.time}` : ""}
                        </p>
                    )}
                    {config.venue && (
                        <p className="mt-1.5 flex items-center gap-2 text-sm font-semibold">
                            <MapPin className="size-4 shrink-0" />
                            {config.venue}
                        </p>
                    )}
                </section>

                {(event?.description || config.about) && (
                    <section className="rounded-xl bg-surface-container-low p-5 shadow-e-1">
                        <h3 className="mb-2 flex items-center gap-2 text-base font-bold text-on-surface">
                            <Info className="size-5 text-secondary" /> What this is
                        </h3>
                        <p className="whitespace-pre-line text-sm leading-6 text-on-surface-variant">
                            {config.about || event?.description}
                        </p>
                    </section>
                )}

                {!event && (
                    <section className="rounded-xl border border-outline-variant p-5">
                        <p className="text-sm leading-6 text-on-surface-variant">
                            No event is configured for{" "}
                            <code className="rounded bg-surface-container-highest px-1.5 py-0.5 text-xs">
                                {CFM_EVENT_SLUG}
                            </code>
                            . Add a matching row to the events table and this page
                            fills itself in.
                        </p>
                    </section>
                )}

                <section className="rounded-xl bg-surface-container-low p-5 shadow-e-1">
                    <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-on-surface">
                        <BookOpen className="size-5 text-tertiary" /> How the games
                        work
                    </h3>
                    <p className="mb-4 text-sm leading-6 text-on-surface-variant">
                        Setup and playing instructions for the Oracle draw, trivia,
                        bingo and the buzzer.
                    </p>
                    <Button asChild variant="tonal" className="w-full">
                        <a
                            href="https://claude.ai/code/artifact/8ef29ffd-55b3-4fb9-a0cb-39be51fba320"
                            target="_blank"
                            rel="noreferrer"
                        >
                            Open the runbook
                        </a>
                    </Button>
                </section>

                <section className="rounded-xl border border-outline-variant p-5 text-center">
                    <div className="flex flex-wrap justify-center gap-2">
                        <Chip variant="secondary" size="sm">
                            RCF FUTA
                        </Chip>
                        <Chip variant="tertiary" size="sm">
                            ICT Team
                        </Chip>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-on-surface-variant">
                        Built and run by the RCF FUTA ICT Team.
                    </p>
                </section>
            </main>
        </div>
    );
}
