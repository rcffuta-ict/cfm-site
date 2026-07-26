import SoundCheck from "@/src/components/SoundCheck";

/**
 * Public, like /network: whoever is on the sound desk may not be signed in, and
 * the TV computer never is.
 */
export const dynamic = "force-dynamic";

export const metadata = {
    title: "Sound check — Combined Family Meeting",
};

export default function SoundPage() {
    return <SoundCheck />;
}
