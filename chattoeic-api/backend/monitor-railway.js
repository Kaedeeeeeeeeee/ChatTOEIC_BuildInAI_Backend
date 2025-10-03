#!/usr/bin/env node

console.log('🚀 Railway Deployment Monitor - Starting...');
console.log('⏰ ' + new Date().toLocaleString());
console.log('🎯 Target: https://chattoeic-api-production.up.railway.app/health');
console.log('📋 Expected version: 3.1.0-RAILWAY-STARTCOMMAND-FIX');
console.log('═'.repeat(60));

const checkInterval = 10000; // 10 seconds
let attemptCount = 0;
const maxAttempts = 30; // 5 minutes total

async function checkHealth() {
  attemptCount++;
  const timestamp = new Date().toLocaleTimeString();

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('https://chattoeic-api-production.up.railway.app/health', {
      timeout: 8000
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ [${timestamp}] SUCCESS! Server is responding:`);
      console.log(JSON.stringify(data, null, 2));

      if (data.version && data.version.includes('3.1.0-RAILWAY-STARTCOMMAND-FIX')) {
        console.log('🎉 DEPLOYMENT SUCCESSFUL! Latest version detected.');
        process.exit(0);
      } else {
        console.log(`⚠️  Version mismatch. Expected: 3.1.0-RAILWAY-STARTCOMMAND-FIX, Got: ${data.version}`);
      }
    } else {
      console.log(`❌ [${timestamp}] HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      console.log(`⏳ [${timestamp}] Attempt ${attemptCount}/${maxAttempts} - Server not ready (${error.code})`);
    } else {
      console.log(`❌ [${timestamp}] Error: ${error.message}`);
    }
  }

  if (attemptCount >= maxAttempts) {
    console.log('\n💥 Max attempts reached. Railway deployment may have failed.');
    console.log('📋 Please check Railway logs manually.');
    process.exit(1);
  }

  // Continue monitoring
  setTimeout(checkHealth, checkInterval);
}

// Start monitoring
checkHealth();