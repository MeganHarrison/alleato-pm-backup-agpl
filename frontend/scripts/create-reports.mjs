import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://lgveqfnpkxvzbnnwuled.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxndmVxZm5wa3h2emJubnd1bGVkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTI1NDE2NiwiZXhwIjoyMDcwODMwMTY2fQ.kIFo_ZSwO1uwpttYXxjSnYbBpUhwZhkW-ZGaiQLhKmA";

// Sign in as test user to get a valid JWT for the API
const anonKey = await fetch(`${SUPABASE_URL}/rest/v1/`, {
  headers: { "apikey": SERVICE_KEY }
}).catch(() => null);

// Use service role to sign in
const db = createClient(SUPABASE_URL, SERVICE_KEY);
const { data: authData, error: authError } = await db.auth.signInWithPassword({
  email: "test1@mail.com",
  password: "test12026!!!",
});

if (authError || !authData.session) {
  console.error("Auth failed:", authError?.message);
  process.exit(1);
}

const token = authData.session.access_token;
const projects = [31, 25125, 60]; // Uniqlo NJ, Goodwill Noblesville, Alleato Finance

for (const projectId of projects) {
  console.log(`\nCreating report for project ${projectId}...`);
  const res = await fetch(`http://localhost:3000/api/projects/${projectId}/progress-reports`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "Cookie": `sb-lgveqfnpkxvzbnnwuled-auth-token=${token}`,
    },
    body: JSON.stringify({}),
  });
  
  if (!res.ok) {
    const text = await res.text();
    console.error(`  ✗ ${res.status}: ${text.slice(0, 200)}`);
    continue;
  }
  
  const result = await res.json();
  console.log(`  ✓ Report created: ID=${result.reportId}, week ${result.weekStart} → ${result.weekEnd}`);
}
