"use server";

import { getAdminClient, broadcastOracleEvent } from "@/src/lib/supabase/server";
import { getCfmEvent } from "@/src/lib/event";

const RAFFLE_BASE = parseInt(process.env.RAFFLE_ID_BASE || "42700", 10);

async function generateRaffleId(eventId: string): Promise<number> {
    const supabase = getAdminClient();
    const { data: existing } = await supabase
        .from("event_registrations")
        .select("raffle_id")
        .eq("event_id", eventId)
        .not("raffle_id", "is", null);

    const taken = new Set((existing || []).map((r: any) => r.raffle_id as number));
    let base = RAFFLE_BASE;

    for (let attempt = 0; attempt < 500; attempt++) {
        const jitter = Math.floor(Math.random() * 100);
        const id = base + jitter;
        if (!taken.has(id)) return id;
        const bandCount = [...taken].filter(
            (x) => Math.floor(x / 100) === Math.floor(base / 100)
        ).length;
        if (bandCount >= 80) base += 100;
    }
    throw new Error("Could not generate unique raffle ID");
}

export async function manualRegisterAction(formData: FormData) {
    const firstName = (formData.get("firstName") as string)?.trim();
    const lastName = (formData.get("lastName") as string)?.trim();
    const email = (formData.get("email") as string)?.trim() || null;
    const phone = (formData.get("phone") as string)?.trim() || "";
    const level = (formData.get("level") as string)?.trim() || "N/A";
    const gender = (formData.get("gender") as string)?.trim() || "N/A";

    if (!firstName || !lastName) {
        return { success: false, error: "First name and Last name are required." };
    }

    try {
        const supabase = getAdminClient();
        
        const event = await getCfmEvent(supabase);
        if (!event) {
            return { success: false, error: "Event not found. Contact admin." };
        }
        if (!event.is_active) {
            return {
                success: false,
                error: "The event is not live yet. Please check back later.",
            };
        }

        // if an email is provided we check if they are already registered
        if (email) {
            const { data: existing } = await supabase
                .from("event_registrations")
                .select("id, raffle_id")
                .eq("event_id", event.id)
                .eq("email", email)
                .maybeSingle();

            if (existing) {
                return { success: true, data: { raffleId: existing.raffle_id, message: "User already registered" } };
            }
        }

        const raffleId = await generateRaffleId(event.id);
        
        const insertData = {
            event_id: event.id,
            first_name: firstName,
            last_name: lastName,
            email: email,
            phone_number: phone,
            level: level,
            gender: gender,
            raffle_id: raffleId,
            is_rcf_member: false,
        };

        const { error: insertError } = await supabase.from("event_registrations").insert(insertData);
        
        if (insertError) {
            console.error("[manualRegisterAction] Insert Error:", insertError);
            return { success: false, error: insertError.message || "Failed to save registration." };
        }
        
        broadcastOracleEvent("stats:update", {}).catch(() => {});

        return {
            success: true,
            data: {
                raffleId,
                message: "Successfully registered"
            },
        };
    } catch (error: any) {
        console.error("[manualRegisterAction]", error);
        return { success: false, error: error?.message || "Registration failed." };
    }
}
