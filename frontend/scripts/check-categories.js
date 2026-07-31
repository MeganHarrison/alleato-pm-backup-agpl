const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkCategories() {
  // Get unique categories
  const { data, error } = await supabase
    .from('crawled_pages')
    .select('category')
    .not('category', 'is', null);
  
  if (error) {
    console.error('Error fetching categories:', error);
    return;
  }
  
  const uniqueCategories = [...new Set(data.map(item => item.category))].sort();
  console.log('Unique categories in database:', uniqueCategories);
  
  // Count pages per category
  for (const category of uniqueCategories) {
    const { count } = await supabase
      .from('crawled_pages')
      .select('*', { count: 'exact', head: true })
      .eq('category', category);
    
    console.log(`  ${category}: ${count} chunks`);
  }
}

checkCategories();