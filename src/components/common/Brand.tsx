import Image from "next/image";
import { cn } from "@/src/lib/utils";

/**
 * Single source of truth for every brand mark in the app — import these instead
 * of hand-writing <Image src="/logo/…">.
 *
 * Why the "plate": all four logo files are artwork drawn for a light ground.
 * The CFM wordmark and icon carry thick white outlines, and the ICT lockup is
 * two-tone with a dark-navy "RCF FUTA" badge. Dropped straight onto our dark
 * tonal surface, the CFM marks halo and the ICT badge all but disappears. So a
 * mark is set on a light plate — which in Material terms is simply a light
 * surface container with proper clear space around the logo. The logo is
 * honoured as drawn, and it reads at any size.
 */

type Treatment = "plate" | "bare";

interface MarkProps {
    width?: number;
    height?: number;
    className?: string;
    /** Class applied to the plate itself (padding, radius, shadow). */
    plateClassName?: string;
    priority?: boolean;
    /** `plate` (default) sets the mark on a light container; `bare` doesn't. */
    treatment?: Treatment;
}

function Plate({
    children,
    className,
    noBg,
}: {
    children: React.ReactNode;
    className?: string;
    noBg?:boolean;
}) {
    return (
        <span
            className={cn(
                "inline-flex items-center justify-center rounded-lg p-3 shadow-e-1",
                noBg ? undefined : "bg-[#FBFAFD]",
                className
            )}
        >
            {children}
        </span>
    );
}

/** Full "Combined Family Meeting" lockup. Use for hero moments. */
export function CfmLogo({
    width = 220,
    height = 110,
    className,
    plateClassName,
    priority,
    treatment = "plate",
}: MarkProps) {
    const img = (
        <Image
            src="/logo/cfm-logo.png"
            alt="Combined Family Meeting"
            width={width}
            height={height}
            priority={priority}
            className={cn("h-auto w-auto object-contain", className)}
        />
    );
    return treatment === "plate" ? (
        <Plate noBg className={plateClassName}>{img}</Plate>
    ) : (
        img
    );
}

/** Compact CFM "F⚡" icon. Use as the app mark. */
export function CfmIcon({
    width = 64,
    height = 64,
    className,
    plateClassName,
    priority,
    treatment = "plate",
}: MarkProps) {
    const img = (
        <Image
            src="/logo/cfm-icon.png"
            alt="RCF FUTA — Combined Family Meeting"
            width={width}
            height={height}
            priority={priority}
            className={cn("h-auto w-auto object-contain", className)}
        />
    );
    return treatment === "plate" ? (
        <Plate className={cn("p-2", plateClassName)}>{img}</Plate>
    ) : (
        img
    );
}
