"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/src/lib/utils";

/**
 * The one way we render a person in this app.
 *
 * Honours a member's own profile picture whenever they have one, and falls back
 * to their initials on a tonal container when they don't — or when the image
 * 404s / the host is unreachable. Both states are first-class: nobody looks like
 * a broken box.
 *
 * We deliberately use a plain <img> rather than next/image: avatar URLs come
 * from whatever host the main RCF FUTA profile app uploaded to, and next/image
 * hard-crashes the page on an unconfigured remote host. A missing picture must
 * never be able to take a screen down — least of all a TV in front of a hall.
 */

const avatarVariants = cva(
    "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden font-bold uppercase leading-none tracking-tight",
    {
        variants: {
            size: {
                xs: "h-8 w-8 rounded-sm text-[0.65rem]",
                sm: "h-10 w-10 rounded-sm text-xs",
                md: "h-14 w-14 rounded-md text-base",
                lg: "h-20 w-20 rounded-lg text-2xl",
                /** Scales with the viewport for the church TV screens. */
                tv: "h-[clamp(6rem,14vw,13rem)] w-[clamp(6rem,14vw,13rem)] rounded-xl text-[clamp(1.8rem,5vw,4.5rem)]",
            },
            tone: {
                primary: "bg-primary-container text-on-primary-container",
                secondary: "bg-secondary-container text-on-secondary-container",
                tertiary: "bg-tertiary-container text-on-tertiary-container",
            },
        },
        defaultVariants: { size: "md", tone: "primary" },
    }
);

export interface AvatarProps
    extends Omit<React.HTMLAttributes<HTMLDivElement>, "children">,
        VariantProps<typeof avatarVariants> {
    /** The member's profile picture, when they have one. */
    src?: string | null;
    /** Used for the alt text and to derive initials. */
    name?: string | null;
    /** Adds a Material outline around the mark. */
    outlined?: boolean;
}

/** "Precious Adeyemi" → "PA"; single names → first letter. */
function initialsFrom(name?: string | null): string {
    const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
    src,
    name,
    size,
    tone,
    outlined = false,
    className,
    ...props
}: AvatarProps) {
    const [failed, setFailed] = React.useState(false);

    // A member can change their picture mid-session; retry rather than staying
    // stuck on the fallback from a previously broken URL.
    React.useEffect(() => setFailed(false), [src]);

    const showImage = Boolean(src) && !failed;

    return (
        <div
            className={cn(
                avatarVariants({ size, tone }),
                // A real photo sits on a neutral plate so it is never tinted by
                // the container colour behind it.
                showImage && "bg-surface-container-highest",
                outlined && "ring-1 ring-inset ring-outline-variant",
                className
            )}
            {...props}
        >
            {showImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={src as string}
                    alt={name ? `${name}'s profile picture` : "Profile picture"}
                    onError={() => setFailed(true)}
                    className="h-full w-full object-cover"
                />
            ) : (
                <span aria-hidden="true">{initialsFrom(name)}</span>
            )}
        </div>
    );
}

export { avatarVariants };
