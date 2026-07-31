import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lgveqfnpkxvzbnnwuled.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('Please set SUPABASE_SERVICE_ROLE_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTestUser() {
  try {
    // First, check if the auth user exists
    const { data: authUser } = await supabase.auth.admin.listUsers();
    const testAuthUser = authUser?.users?.find(u => u.email === 'test1@mail.com');

    let authUserId;
    if (!testAuthUser) {
      // Create auth user
      console.log('Creating auth user test1@mail.com...');
      const { data: newAuthUser, error: authError } = await supabase.auth.admin.createUser({
        email: 'test1@mail.com',
        password: 'test12026!!!',
        email_confirm: true
      });

      if (authError) {
        console.error('Error creating auth user:', authError);
        return;
      }
      authUserId = newAuthUser.user.id;
      console.log('Auth user created:', authUserId);
    } else {
      authUserId = testAuthUser.id;
      console.log('Auth user already exists:', authUserId);
    }

    // Check if person exists
    const { data: existingPerson } = await supabase
      .from('people')
      .select('*')
      .eq('email', 'test1@mail.com')
      .single();

    let personId;
    if (!existingPerson) {
      // Create person
      console.log('Creating person record...');
      const { data: newPerson, error: personError } = await supabase
        .from('people')
        .insert({
          email: 'test1@mail.com',
          first_name: 'Test',
          last_name: 'User',
          person_type: 'contact',
          status: 'active'
        })
        .select()
        .single();

      if (personError) {
        console.error('Error creating person:', personError);
        return;
      }
      personId = newPerson.id;
      console.log('Person created:', personId);
    } else {
      personId = existingPerson.id;
      console.log('Person already exists:', personId);
    }

    // Link auth user to person
    const { data: existingLink } = await supabase
      .from('users_auth')
      .select('*')
      .eq('person_id', personId)
      .single();

    if (!existingLink) {
      console.log('Linking auth user to person...');
      const { error: linkError } = await supabase
        .from('users_auth')
        .insert({
          person_id: personId,
          auth_user_id: authUserId
        });

      if (linkError) {
        console.error('Error linking user:', linkError);
        return;
      }
      console.log('User linked successfully!');
    } else {
      console.log('User already linked');
    }

    console.log('\n✅ Test user setup complete!');
    console.log('Email: test1@mail.com');
    console.log('Password: test12026!!!');
    console.log('Person ID:', personId);
    console.log('Auth User ID:', authUserId);

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

createTestUser();