const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTestUser() {
  const testEmail = 'test@example.com';
  const testPassword = 'TestPassword123!';

  try {
    // First, let's try to sign up the user (this will fail if user exists)
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          role: 'admin',
          name: 'Test User'
        }
      }
    });

    if (signUpError) {
      if (signUpError.message.includes('already registered')) {
        console.log('Test user already exists:', testEmail);
        console.log('Attempting to sign in to verify credentials...');
        
        // Try to sign in to verify the password works
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: testEmail,
          password: testPassword
        });
        
        if (signInError) {
          console.log('Note: Cannot sign in with default password. User may have a different password.');
          console.log('You may need to reset the password manually in Supabase dashboard.');
        } else {
          console.log('Successfully verified test user credentials!');
          await supabase.auth.signOut();
        }
        
        return { email: testEmail, password: testPassword };
      }
      throw signUpError;
    }

    console.log('Test user created successfully:', testEmail);
    console.log('Password:', testPassword);
    
    if (signUpData.user) {
      // Keep the profile table aligned with auth so local test logins work consistently.
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          id: signUpData.user.id,
          email: testEmail,
          full_name: 'Test User',
          role: 'admin'
        }, {
          onConflict: 'id'
        });

      if (profileError && profileError.code !== '23505') { // Ignore duplicate key errors
        console.log('Note: Could not create user profile:', profileError.message);
      }
    }

    // Sign out after creating user
    await supabase.auth.signOut();

    return { email: testEmail, password: testPassword };
  } catch (error) {
    console.error('Failed to setup test user:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createTestUser()
    .then(({ email, password }) => {
      console.log('\n✅ Test user ready!');
      console.log('Email:', email);
      console.log('Password:', password);
      console.log('\nYou can now run your tests with these credentials.');
    })
    .catch(console.error);
}

module.exports = { createTestUser };
