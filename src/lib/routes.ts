/**
 * Routes rendered by the `(tv-screens)` route group — the screens that run
 * full-bleed on the TVs in the church rather than on a phone or laptop.
 *
 * Route groups don't appear in the URL, so client components that need to know
 * "am I on a TV?" have to match on the pathname. Keeping that list here means
 * adding a new TV screen is a one-line change instead of a hunt through the
 * layout chrome.
 */
export const TV_ROUTES = ["/oracle", "/stats", "/games"] as const;

export function isTvRoute(pathname: string | null | undefined): boolean {
    if (!pathname) return false;
    return TV_ROUTES.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`)
    );
}
