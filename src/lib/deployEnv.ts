/**
 * Which deployment this is.
 *
 * Read on the server from Vercel's system environment variables, so it doesn't
 * depend on "expose system environment variables" being switched on for the
 * client bundle — that setting is easy to toggle off by accident, and a preview
 * banner that silently stops appearing is worse than no banner at all.
 *
 * Production is deliberately unmarked: the whole point is that a preview looks
 * unmistakably different from the thing members and the host will actually use.
 */
export interface DeployEnv {
    isPreview: boolean;
    /** Git branch the preview was built from, when Vercel tells us. */
    branch: string | null;
    /** Short commit SHA, for pinning down exactly what's deployed. */
    sha: string | null;
}

export function getDeployEnv(): DeployEnv {
    const vercelEnv = process.env.VERCEL_ENV ?? process.env.NEXT_PUBLIC_VERCEL_ENV;

    return {
        isPreview: vercelEnv === "preview",
        branch:
            process.env.VERCEL_GIT_COMMIT_REF ??
            process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF ??
            null,
        sha: (
            process.env.VERCEL_GIT_COMMIT_SHA ??
            process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
            ""
        ).slice(0, 7) || null,
    };
}
