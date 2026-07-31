const https = require('https');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'TestPassword123!';

function makeRequest(path, method, data) {
  const url = new URL(path, SUPABASE_URL);
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(JSON.stringify(parsed)));
          }
        } catch (e) {
          reject(new Error(`Status ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function createTestUser() {
  try {
    console.log('Setting up test user...');
    
    // Try to create user using the Admin API
    try {
      const userData = await makeRequest('/auth/v1/admin/users', 'POST', {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        email_confirm: true,
        user_metadata: {
          role: 'admin',
          name: 'Test User'
        }
      });
      
      console.log('✅ Test user created successfully!');
      console.log('Email:', TEST_EMAIL);
      console.log('Password:', TEST_PASSWORD);
      return { email: TEST_EMAIL, password: TEST_PASSWORD };
    } catch (error) {
      const errorMsg = error.message;
      if (errorMsg.includes('already registered') || errorMsg.includes('duplicate')) {
        console.log('Test user already exists:', TEST_EMAIL);
        console.log('Email:', TEST_EMAIL);
        console.log('Password:', TEST_PASSWORD);
        return { email: TEST_EMAIL, password: TEST_PASSWORD };
      }
      throw error;
    }
  } catch (error) {
    console.error('Failed to create test user:', error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createTestUser()
    .then(() => {
      console.log('\nYou can now run your tests with these credentials.');
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { createTestUser };