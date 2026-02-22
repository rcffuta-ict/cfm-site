import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://izofyqiaazidryoejsot.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6b2Z5cWlhYXppZHJ5b2Vqc290Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzg4NTg4NiwiZXhwIjoyMDgzNDYxODg2fQ.Qgv5Bip9lOgtRZf7CvF1tyS5MXyPzGntrNxeSCwFtz8'
);

async function testInsert() {
  const { data: event } = await supabase
      .from("events")
      .select("id, title, date")
      .eq("slug", "cfm-rcffuta")
      .maybeSingle();

  if (!event) {
    console.log("No event found");
    return;
  }

  const { data, error } = await supabase.from("event_registrations").insert({
      event_id: event.id,
      first_name: "Test",
      last_name: "Test",
      email: "test-" + Date.now() + "@example.com",
      phone_number: "08012345678",
      level: "100L",
      gender: "Male",
      raffle_id: 99999,
      is_rcf_member: true,
  });

  console.log("Insert Result:", { data, error });
}

testInsert();
