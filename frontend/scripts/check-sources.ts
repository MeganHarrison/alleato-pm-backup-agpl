#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSources() {
  const { data, error } = await supabase
    .from('sources')
    .select('*');
  
  if (error) {
    console.error('Error fetching sources:', error);
  } else {
    console.log('Available sources:', data);
  }
}

checkSources();