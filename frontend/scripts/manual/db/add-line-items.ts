import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lgveqfnpkxvzbnnwuled.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxndmVxZm5wa3h2emJubnd1bGVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNTQxNjYsImV4cCI6MjA3MDgzMDE2Nn0.g56kDPUokoJpWY7vXd3GTMXpOc4WFOU0hDVWfGMZtO8';

const CONTRACT_ID = '33f9bb5c-23d0-4a7d-8f1c-35d4f0585bf3';

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Sign in
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'test1@mail.com',
    password: 'test12026!!!'
  });

  if (authError) {
    console.error('Auth error:', authError);
    return;
  }

  console.log('Signed in as:', authData.user?.email);

  // Use contract_line_items table (references prime_contracts with UUID)
  // Note: total_cost is a generated column (quantity * unit_cost), so we don't insert it
  const lineItems = [
    {
      contract_id: CONTRACT_ID,
      line_number: 1,
      description: 'General Conditions',
      quantity: 1,
      unit_cost: 25000,
    },
    {
      contract_id: CONTRACT_ID,
      line_number: 2,
      description: 'Site Work & Excavation',
      quantity: 1,
      unit_cost: 35000,
    },
    {
      contract_id: CONTRACT_ID,
      line_number: 3,
      description: 'Concrete Foundation',
      quantity: 1,
      unit_cost: 45000,
    },
    {
      contract_id: CONTRACT_ID,
      line_number: 4,
      description: 'Structural Steel',
      quantity: 1,
      unit_cost: 30000,
    },
    {
      contract_id: CONTRACT_ID,
      line_number: 5,
      description: 'Electrical',
      quantity: 1,
      unit_cost: 15000,
    },
  ];

  console.log('Adding line items to contract_line_items...');

  const { data: inserted, error: insertError } = await supabase
    .from('contract_line_items')
    .insert(lineItems)
    .select();

  if (insertError) {
    console.error('Error inserting line items:', insertError);
    return;
  }

  console.log('Line items added successfully:', inserted?.length);
  inserted?.forEach((item, i) => {
    console.log(`  ${i+1}. ${item.description}: $${item.total_cost}`);
  });

  // Calculate total (quantity * unit_cost for each)
  const total = lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);
  console.log(`\nTotal SOV value: $${total.toLocaleString()}`);
}

main().catch(console.error);
