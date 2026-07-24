import { cn } from "@/src/lib/utils";

/**
 * The shared app backdrop: drifting brand glows + a faint technical grid +
 * film grain. Rendered once per screen (fixed, behind content) so the
 * background reads the same everywhere.
 */
export function Ambient({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                "pointer-events-none fixed inset-0 -z-10 overflow-hidden",
                className
            )}
            aria-hidden="true"
        >
            <span className="absolute -left-[8%] -top-[12%] h-[46vw] max-h-[620px] w-[46vw] max-w-[620px] animate-drift-slow rounded-full bg-brand-purple/40 blur-[140px] mix-blend-screen" />
            <span className="absolute -bottom-[14%] -right-[6%] h-[42vw] max-h-[560px] w-[42vw] max-w-[560px] animate-drift-slower rounded-full bg-brand-blue/40 blur-[140px] mix-blend-screen" />
            <span className="absolute left-[46%] top-[42%] h-[34vw] max-h-[460px] w-[34vw] max-w-[460px] animate-drift-slow rounded-full bg-brand-pink/25 blur-[140px] mix-blend-screen" />
            <span className="absolute inset-0 bg-tech-grid" />
            <span className="absolute inset-0 bg-noise opacity-[0.5] mix-blend-overlay" />
        </div>
    );
}

export default Ambient;
