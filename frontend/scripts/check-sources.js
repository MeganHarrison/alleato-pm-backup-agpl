const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAndCreateSource() {
  // First check if 'procore-docs' source exists
  const { data: sources, error: fetchError } = await supabase
    .from('sources')
    .select('*');
  
  if (fetchError) {
    console.error('Error fetching sources:', fetchError);
    return;
  }
  
  console.log('Existing sources:', sources?.map(s => s.id) || []);
  
  // Check if 'procore-docs' exists
  const procoreDocsExists = sources?.some(s => s.id === 'procore-docs');
  
  if (!procoreDocsExists) {
    console.log('Creating procore-docs source...');
    const { error: insertError } = await supabase
      .from('sources')
      .insert({
        id: 'procore-docs',
        name: 'Procore Documentation',
        url: 'https://support.procore.com',
      });
    
    if (insertError) {
      console.error('Error creating source:', insertError);
    } else {
      console.log('Successfully created procore-docs source');
    }
  } else {
    console.log('procore-docs source already exists');
  }
}

checkAndCreateSource();