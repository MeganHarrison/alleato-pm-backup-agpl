import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lgveqfnpkxvzbnnwuled.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('Please set SUPABASE_SERVICE_ROLE_KEY environment variable');
  console.log('You can find it in your .env.local file or Supabase dashboard');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function grantPermissions() {
  try {
    console.log('Creating/updating Project Admin permission template...');

    // First, check if template exists
    const { data: existingTemplate } = await supabase
      .from('permission_templates')
      .select('*')
      .eq('name', 'Project Admin')
      .eq('scope', 'project')
      .single();

    let template;
    if (!existingTemplate) {
      // Create new template
      const { data: newTemplate, error: templateError } = await supabase
        .from('permission_templates')
        .insert({
          name: 'Project Admin',
          description: 'Full admin access to all project modules',
          scope: 'project',
          rules_json: {
            directory: ['read', 'write', 'admin'],
            budget: ['read', 'write', 'admin'],
            contracts: ['read', 'write', 'admin'],
            documents: ['read', 'write', 'admin'],
            schedule: ['read', 'write', 'admin'],
            submittals: ['read', 'write', 'admin'],
            rfis: ['read', 'write', 'admin'],
            change_orders: ['read', 'write', 'admin']
          }
        })
        .select()
        .single();

      if (templateError) {
        console.error('Error creating template:', templateError);
        return;
      }
      template = newTemplate;
    } else {
      // Update existing template
      const { data: updatedTemplate, error: updateError } = await supabase
        .from('permission_templates')
        .update({
          rules_json: {
            directory: ['read', 'write', 'admin'],
            budget: ['read', 'write', 'admin'],
            contracts: ['read', 'write', 'admin'],
            documents: ['read', 'write', 'admin'],
            schedule: ['read', 'write', 'admin'],
            submittals: ['read', 'write', 'admin'],
            rfis: ['read', 'write', 'admin'],
            change_orders: ['read', 'write', 'admin']
          }
        })
        .eq('id', existingTemplate.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating template:', updateError);
        return;
      }
      template = updatedTemplate;
    }

    console.log('Template created/updated:', template.id);

    // Get the test user's person_id
    console.log('Finding test user...');
    const { data: person, error: personError } = await supabase
      .from('people')
      .select('id')
      .eq('email', 'test1@mail.com')
      .single();

    if (personError || !person) {
      console.error('Test user not found:', personError);
      return;
    }

    console.log('Test user found:', person.id);

    // Grant permissions to test user for project 67
    console.log('Granting permissions for project 67...');
    const { data: membership, error: membershipError } = await supabase
      .from('project_directory_memberships')
      .upsert({
        project_id: 67,
        person_id: person.id,
        permission_template_id: template.id,
        status: 'active',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'project_id,person_id'
      })
      .select()
      .single();

    if (membershipError) {
      console.error('Error granting permissions:', membershipError);
      return;
    }

    console.log('✅ Permissions granted successfully!');
    console.log('Membership:', membership);

    // Verify the permissions
    const { data: verify, error: verifyError } = await supabase
      .from('project_directory_memberships')
      .select(`
        *,
        permission_template:permission_templates(name, rules_json)
      `)
      .eq('project_id', 67)
      .eq('person_id', person.id)
      .single();

    if (verify) {
      console.log('\n✅ Verification successful!');
      console.log('User has the following permissions:', verify.permission_template?.rules_json);
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

grantPermissions();