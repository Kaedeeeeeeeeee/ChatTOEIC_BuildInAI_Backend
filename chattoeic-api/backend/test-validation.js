#!/usr/bin/env node

// Test validation endpoint directly
const fetch = require('node-fetch');

async function testValidation() {
  console.log('🧪 Testing Railway validation endpoint...');

  const testPayload = {
    type: 'READING_PART6',
    difficulty: 'INTERMEDIATE',
    count: 1,
    timeLimit: 600
  };

  try {
    const response = await fetch('https://chattoeicbuildinaibackend-production.up.railway.app/api/questions/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer fake-token-for-testing'
      },
      body: JSON.stringify(testPayload)
    });

    const result = await response.text();

    console.log('📊 Status:', response.status);
    console.log('📄 Response:', result);

    if (response.status === 400) {
      console.log('❌ Validation failed - timeLimit still not accepted');
      console.log('🔧 This confirms Railway is running old validation code');
    } else {
      console.log('✅ Validation passed or different error');
    }

  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testValidation();