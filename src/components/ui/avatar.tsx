"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/src/lib/utils";

/**
 * The one way we render a person in this app.
 *
 * Honours a member's own profile picture whenever they have one, and falls back
 * to their gradient initials when they don't — or when the image 404s / the host
 * is unreachable. Both states are first-class: nobody looks like a broken box.
 *
 * We deliberately use a plain <img> rather than next/image: avatar URLs come
 * from whatever host the main RCF FUTA profile app uploaded to, and next/image
 * hard-crashes the page on an unconfigured remote host. A missing picture must
 * never be able to take a screen down — least of all a TV in front of a hall.
 */

const avatarVariants = cva(
    "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden bg-background font-extrabold uppercase leading-none tracking-tight",
    {
        variants: {
            size: {
                sm: "h-9 w-9 rounded-xl text-[0.7rem]",
                md: "h-16 w-16 rounded-2xl text-xl",
                lg: "h-24 w-24 rounded-3xl text-3xl",
                /** Scales with the viewport for the church TV screens. */
                tv: "h-[clamp(6rem,14vw,13rem)] w-[clamp(6rem,14vw,13rem)] rounded-[2rem] text-[clamp(1.8rem,5vw,4.5rem)]",
            },
        },
        defaultVariants: { size: "md" },
    }
);

export interface AvatarProps
    extends Omit<React.HTMLAttributes<HTMLDivElement>, "children">,
        VariantProps<typeof avatarVariants> {
    /** The member's profile picture, when they have one. */
    src?: string | null;
    /** Used for the alt text and to derive initials. */
    name?: string | null;
    /** Wraps the avatar in the animated conic brand ring. */
    ring?: boolean;
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
    ring = false,
    className,
    ...props
}: AvatarProps) {
    const [failed, setFailed] = React.useState(false);

    // A member can change their picture mid-session; retry rather than staying
    // stuck on the fallback from a previously broken URL.
    React.useEffect(() => setFailed(false), [src]);

    const showImage = Boolean(src) && !failed;

    const inner = (
        <div
            className={cn(
                avatarVariants({ size }),
                // The initials fallback carries the brand gradient; a real photo
                // sits on a neutral plate so it is never tinted.
                !showImage && "bg-brand-gradient text-white",
                "border border-white/10",
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

    if (!ring) return inner;

    return (
        <div className="relative inline-flex">
            <span
                aria-hidden="true"
                className="absolute -inset-1.5 animate-spin-slow rounded-[inherit] opacity-70 blur-md ring-conic"
            />
            <span className="relative">{inner}</span>
        </div>
    );
}

export { avatarVariants };
