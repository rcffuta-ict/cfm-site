import { getDeployEnv } from "@/src/lib/deployEnv";

/**
 * An unmissable marker that this is a preview deployment.
 *
 * Deliberately loud, and deliberately absent in production. On the night
 * somebody will have several tabs open across two deployments — the cost of a
 * subtle badge is running the real programme against a preview build, or worse,
 * rehearsing against production. So it takes real space at the top of the page
 * rather than tucking into a corner.
 *
 * Renders nothing at all outside preview, including locally.
 */
export default function PreviewBanner() {
    const { isPreview, branch, sha } = getDeployEnv();
    if (!isPreview) return null;

    return (
        <div
            role="status"
            aria-label="Preview deployment — not the live app"
            className="sticky top-0 z-[100] w-full border-b-2 border-black/25 bg-tertiary text-on-tertiary"
            style={{
                backgroundImage:
                    "repeating-linear-gradient(45deg, transparent, transparent 12px, rgba(0,0,0,0.09) 12px, rgba(0,0,0,0.09) 24px)",
            }}
        >
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-3 gap-y-0.5 px-4 py-2 text-center">
                <span className="font-display text-sm font-extrabold uppercase tracking-[0.2em]">
                    Preview build
                </span>
                <span className="text-xs font-semibold opacity-90">
                    Not the live app — nothing here is the real programme.
                </span>
                {(branch || sha) && (
                    <span className="font-mono text-[0.68rem] opacity-75">
                        {branch}
                        {branch && sha ? " · " : ""}
                        {sha}
                    </span>
                )}
            </div>
        </div>
    );
}
