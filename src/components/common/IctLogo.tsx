import Image from "next/image";
import Link from "next/link";
import { cn } from "@/src/lib/utils";

/**
 * The RCF FUTA ICT Team credit mark.
 *
 * The two source files are both drawn for light grounds — `ict-logo-dark.png`
 * is the full-contrast navy lockup, and `ict-logo-white.png` is two-tone with a
 * navy "RCF FUTA" badge that would be lost on our dark surface. So the default
 * treatment sets the navy lockup on a light plate, which is legible on every
 * screen in this app. `bare` is available for the rare light-ground case.
 */
interface IctLogoProps {
    className?: string;
    plateClassName?: string;
    width?: number;
    height?: number;
    /** Wraps the mark in a link to the ICT team site. */
    asLink?: boolean;
    treatment?: "plate" | "bare";
}

export function IctLogo({
    className,
    plateClassName,
    width = 96,
    height = 34,
    asLink = false,
    treatment = "plate",
}: IctLogoProps) {
    const img = (
        <Image
            src="/logo/ict-logo-dark.png"
            alt="RCF FUTA ICT Team"
            width={width}
            height={height}
            className={cn("h-auto w-auto object-contain", className)}
        />
    );

    const mark =
        treatment === "plate" ? (
            <span
                className={cn(
                    "inline-flex items-center justify-center rounded-md bg-[#FBFAFD] px-2.5 py-1.5",
                    plateClassName
                )}
            >
                {img}
            </span>
        ) : (
            img
        );

    if (asLink) {
        return (
            <Link
                href="https://ict.rcffuta.com"
                target="_blank"
                rel="noreferrer"
                className="inline-block transition-opacity hover:opacity-80"
            >
                {mark}
            </Link>
        );
    }

    return mark;
}
