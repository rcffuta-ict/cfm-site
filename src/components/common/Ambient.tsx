import { cn } from "@/src/lib/utils";

/**
 * The shared app backdrop.
 *
 * In a Material tonal system the background is meant to recede — depth comes
 * from the surface containers stacked on top of it, not from the backdrop. So
 * this is now a single, very soft tonal wash of the brand hues (see
 * `.surface-wash`), just enough to keep a large dark screen from reading flat.
 * It replaces the drifting neon blobs, grid and film grain of the old theme.
 */
export function Ambient({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                "surface-wash pointer-events-none fixed inset-0 -z-10",
                className
            )}
            aria-hidden="true"
        />
    );
}

export default Ambient;
