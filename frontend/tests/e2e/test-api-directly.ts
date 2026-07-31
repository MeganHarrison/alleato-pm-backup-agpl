// Direct API test without browser

const BASE_URL = 'http://localhost:3000';

async function testAPIs() {
  console.log('Testing Document Pipeline APIs...\n');

  // Test 1: Status endpoint
  console.log('1. Testing GET /api/documents/status');
  try {
    const statusRes = await fetch(`${BASE_URL}/api/documents/status`, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log(`   Status: ${statusRes.status}`);
    console.log(`   Headers:`, statusRes.headers.raw());
    
    if (statusRes.status === 307) {
      console.log('   ❌ FAIL: API redirects to login - needs authentication middleware fix');
    } else if (statusRes.ok) {
      const data = await statusRes.json();
      console.log('   ✅ SUCCESS: Got response:', data);
    } else {
      console.log('   ❌ FAIL: Unexpected status');
    }
  } catch (error) {
    console.log('   ❌ ERROR:', error.message);
  }

  // Test 2: Trigger pipeline GET
  console.log('\n2. Testing GET /api/documents/trigger-pipeline');
  try {
    const triggerRes = await fetch(`${BASE_URL}/api/documents/trigger-pipeline`, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log(`   Status: ${triggerRes.status}`);
    
    if (triggerRes.status === 307) {
      console.log('   ❌ FAIL: API redirects to login - needs authentication middleware fix');
    } else if (triggerRes.ok) {
      const data = await triggerRes.json();
      console.log('   ✅ SUCCESS: Got phase counts:', data);
    } else {
      console.log('   ❌ FAIL: Unexpected status');
    }
  } catch (error) {
    console.log('   ❌ ERROR:', error.message);
  }

  // Test 3: Trigger pipeline POST
  console.log('\n3. Testing POST /api/documents/trigger-pipeline');
  try {
    const triggerRes = await fetch(`${BASE_URL}/api/documents/trigger-pipeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: 'parse' })
    });
    
    console.log(`   Status: ${triggerRes.status}`);
    
    if (triggerRes.status === 307) {
      console.log('   ❌ FAIL: API redirects to login - needs authentication middleware fix');
    } else if (triggerRes.ok) {
      const data = await triggerRes.json();
      console.log('   ✅ SUCCESS: Trigger response:', data);
    } else {
      console.log('   ❌ FAIL: Unexpected status');
    }
  } catch (error) {
    console.log('   ❌ ERROR:', error.message);
  }

  console.log('\n\nSUMMARY: The APIs are protected by authentication middleware.');
  console.log('This is actually correct behavior - admin APIs should require auth.');
  console.log('The issue is that we need to handle auth properly in the tests.\n');
}

testAPIs();