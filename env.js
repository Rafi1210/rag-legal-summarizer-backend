// check-env.js - Run this to verify environment variables
import dotenv from 'dotenv';

// Load .env file if it exists (for local testing)
dotenv.config();

console.log('=== Environment Variable Check ===');
console.log('NODE_ENV:', process.env.NODE_ENV || 'undefined');
console.log('PORT:', process.env.PORT || 'undefined');

console.log('\n=== Firebase Variables ===');
console.log('FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID ? '✓ SET' : '✗ MISSING');
console.log('FIREBASE_CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL ? '✓ SET' : '✗ MISSING');
console.log('FIREBASE_PRIVATE_KEY:', process.env.FIREBASE_PRIVATE_KEY ? '✓ SET' : '✗ MISSING');

if (process.env.FIREBASE_PROJECT_ID) {
  console.log('  PROJECT_ID value:', process.env.FIREBASE_PROJECT_ID);
}

if (process.env.FIREBASE_CLIENT_EMAIL) {
  console.log('  CLIENT_EMAIL value:', process.env.FIREBASE_CLIENT_EMAIL);
}

if (process.env.FIREBASE_PRIVATE_KEY) {
  console.log('  PRIVATE_KEY preview:', process.env.FIREBASE_PRIVATE_KEY.substring(0, 50) + '...');
  console.log('  PRIVATE_KEY length:', process.env.FIREBASE_PRIVATE_KEY.length);
  console.log('  Contains newlines:', process.env.FIREBASE_PRIVATE_KEY.includes('\\n') ? 'YES' : 'NO');
}

console.log('\n=== Database Variables ===');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✓ SET' : '✗ MISSING');

const allFirebaseVarsSet = process.env.FIREBASE_PROJECT_ID && 
                          process.env.FIREBASE_CLIENT_EMAIL && 
                          process.env.FIREBASE_PRIVATE_KEY;

console.log('\n=== Summary ===');
console.log('All Firebase vars set:', allFirebaseVarsSet ? '✓ YES' : '✗ NO');

if (!allFirebaseVarsSet) {
  console.log('\n=== Action Required ===');
  console.log('Set these environment variables in Render:');
  if (!process.env.FIREBASE_PROJECT_ID) console.log('- FIREBASE_PROJECT_ID');
  if (!process.env.FIREBASE_CLIENT_EMAIL) console.log('- FIREBASE_CLIENT_EMAIL');
  if (!process.env.FIREBASE_PRIVATE_KEY) console.log('- FIREBASE_PRIVATE_KEY');
}