/**
 * Turning database errors into something a member can act on.
 *
 * Raw Postgres text was reaching people during the live event — a member saw
 * `duplicate key value violates unique constraint "unique_event_phone"`, which
 * tells them nothing and looks broken. Everything user-facing goes through here
 * instead: the real error is logged server-side for us, and the person gets a
 * sentence that says what happened and what to do.
 */

interface DbError {
    code?: string;
    message?: string;
    details?: string;
    constraint?: string;
}

/**
 * Messages for the constraints we actually have, keyed by constraint name.
 * Anything not listed falls back to a generic message for its error class —
 * never to the raw text.
 */
const CONSTRAINT_MESSAGES: Record<string, string> = {
    unique_event_phone:
        "That phone number is already registered for this event. If it's yours, sign in with the email you used the first time — or ask the ICT desk to check.",
    event_registrations_raffle_id_key:
        "We hit a clash generating your Oracle ID. Please try again — it should work on the second attempt.",
    profiles_email_key: "That email is already on another profile.",
    profiles_matric_number_key: "That matric number is already on another profile.",
};

const CODE_MESSAGES: Record<string, string> = {
    // unique_violation
    "23505": "That's already been recorded.",
    // foreign_key_violation
    "23503": "Something that record depends on is missing. Contact the ICT desk.",
    // not_null_violation
    "23502": "Some required details are missing from your profile. Contact the ICT desk.",
    // check_violation
    "23514": "Those details don't look right. Please check and try again.",
    // invalid_text_representation
    "22P02": "Those details don't look right. Please check and try again.",
    // insufficient_privilege
    "42501": "You don't have permission to do that.",
    // undefined_table — a migration hasn't been run
    "42P01": "That feature isn't set up yet. Contact the ICT desk.",
};

/** Extract the constraint name from a Postgres error, however it's reported. */
function constraintOf(error: DbError): string | null {
    if (error.constraint) return error.constraint;
    const match = /unique constraint "([^"]+)"/.exec(
        `${error.message ?? ""} ${error.details ?? ""}`
    );
    return match?.[1] ?? null;
}

export function isUniqueViolation(error: unknown): boolean {
    return (error as DbError | null)?.code === "23505";
}

/**
 * A message safe to show a member. Always log the original alongside this —
 * `friendlyError` deliberately throws away the detail we'd need to debug.
 */
export function friendlyError(
    error: unknown,
    fallback = "Something went wrong. Please try again."
): string {
    if (!error) return fallback;

    const db = error as DbError;

    const constraint = constraintOf(db);
    if (constraint && CONSTRAINT_MESSAGES[constraint])
        return CONSTRAINT_MESSAGES[constraint];

    if (db.code && CODE_MESSAGES[db.code]) return CODE_MESSAGES[db.code];

    // Network-shaped failures are worth naming, since the fix is different.
    const text = String(db.message ?? "");
    if (/fetch failed|ECONNREFUSED|ETIMEDOUT|network/i.test(text))
        return "We couldn't reach the server. Check your connection and try again.";

    return fallback;
}

/** Log the real error, return the safe one. The pairing you almost always want. */
export function reportError(
    context: string,
    error: unknown,
    fallback?: string
): string {
    console.error(`[${context}]`, error);
    return friendlyError(error, fallback);
}
