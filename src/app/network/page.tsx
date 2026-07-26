import NetworkCheck from "@/src/components/NetworkCheck";

/**
 * Public on purpose: someone whose connection is bad enough to be worth
 * checking may also be struggling to sign in.
 */
export const dynamic = "force-dynamic";

export const metadata = {
    title: "Connection check — Combined Family Meeting",
};

export default function NetworkPage() {
    return <NetworkCheck />;
}
