#!/usr/bin/env node

// 🚨 RAILWAY CACHE BUSTER - Force complete redeploy
console.log('🚨 RAILWAY CACHE BUSTER ACTIVATED');
console.log('🔄 This file forces Railway to detect changes and rebuild');
console.log('📅 Generated:', new Date().toISOString());
console.log('🎯 Target version: 3.4.0-TIMELIMIT-VALIDATION-FIXED');
console.log('🔧 Critical fix: timeLimit validation in src/middleware/validation.ts');
console.log('⚡ Railway must deploy this version!');

// Check if this is actually being executed in Railway
if (process.env.RAILWAY_ENVIRONMENT) {
  console.log('✅ Running in Railway environment');
  console.log('🆔 Environment:', process.env.RAILWAY_ENVIRONMENT);
} else {
  console.log('⚠️  Not running in Railway environment');
}

// Export timestamp for verification
module.exports = {
  version: '3.4.0-TIMELIMIT-VALIDATION-FIXED',
  bustedAt: new Date().toISOString(),
  reason: 'Force Railway to deploy timeLimit validation fix'
};