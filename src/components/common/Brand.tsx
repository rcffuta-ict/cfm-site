import Image from "next/image";
import clsx from "clsx";

/**
 * Single source of truth for the CFM brand marks. Import these everywhere
 * instead of hand-writing <Image src="/logo/…"> so the logo/icon is never
 * duplicated across screens.
 */

interface MarkProps {
    width?: number;
    height?: number;
    className?: string;
    priority?: boolean;
}

/** Full "Combined Family Meeting" lockup logo. */
export function CfmLogo({
    width = 150,
    height = 150,
    className,
    priority,
}: MarkProps) {
    return (
        <Image
            src="/logo/cfm-logo.png"
            alt="RCF FUTA — Combined Family Meeting"
            width={width}
            height={height}
            priority={priority}
            className={clsx("object-contain h-auto w-auto", className)}
        />
    );
}

/** Compact CFM icon (favicon-style mark). */
export function CfmIcon({
    width = 64,
    height = 64,
    className,
    priority,
}: MarkProps) {
    return (
        <Image
            src="/logo/cfm-icon.png"
            alt="RCF FUTA"
            width={width}
            height={height}
            priority={priority}
            className={clsx("object-contain h-auto w-auto", className)}
        />
    );
}
