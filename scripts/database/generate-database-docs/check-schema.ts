#!/usr/bin/env tsx
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", override: false });
loadEnv({ path: ".env", override: false });
loadEnv({ path: "frontend/.env.local", override: false });
loadEnv({ path: "frontend/.env", override: false });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in local env files.",
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchemas() {
  console.log('\n🔍 Checking table schemas...\n');

  // Check prime_contract_change_orders
  const { data: co, error: coError } = await supabase
    .from('prime_contract_change_orders')
    .select('*')
    .limit(1);

  console.log('prime_contract_change_orders columns:', Object.keys(co?.[0] || {}));
  if (coError) console.log('  Error:', coError.message);

  // Check commitments
  const { data: comm, error: commError } = await supabase
    .from('commitments_unified')
    .select('*')
    .limit(1);

  console.log('\ncommitments_unified columns:', Object.keys(comm?.[0] || {}));
  if (commError) console.log('  Error:', commError.message);

  // Check direct_costs
  const { data: dc, error: dcError } = await supabase
    .from('direct_costs')
    .select('*')
    .limit(1);

  console.log('\ndirect_costs columns:', Object.keys(dc?.[0] || {}));
  if (dcError) console.log('  Error:', dcError.message);

  // Check budget_modifications
  const { data: bm, error: bmError } = await supabase
    .from('budget_modifications')
    .select('*')
    .limit(1);

  console.log('\nbudget_modifications columns:', Object.keys(bm?.[0] || {}));
  if (bmError) console.log('  Error:', bmError.message);
}

checkSchemas();
