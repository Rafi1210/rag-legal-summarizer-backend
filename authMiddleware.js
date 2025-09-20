import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Debug: Log environment info
console.log('Environment:', process.env.NODE_ENV);
console.log('FIREBASE_PROJECT_ID exists:', !!process.env.FIREBASE_PROJECT_ID);
console.log('FIREBASE_CLIENT_EMAIL exists:', !!process.env.FIREBASE_CLIENT_EMAIL);
console.log('FIREBASE_PRIVATE_KEY exists:', !!process.env.FIREBASE_PRIVATE_KEY);

// Initialize Firebase Admin SDK
try {
  let initMethod = 'unknown';
  
  // Check if we have all required environment variables
  const hasEnvVars = process.env.FIREBASE_PROJECT_ID && 
                    process.env.FIREBASE_CLIENT_EMAIL && 
                    process.env.FIREBASE_PRIVATE_KEY;

  if (hasEnvVars) {
    console.log('All Firebase environment variables found, using env vars...');
    initMethod = 'environment variables';
    
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
  } else {
    console.log('Environment variables missing, checking for JSON file...');
    const jsonPath = join(__dirname, 'service-account.json');
    console.log('Looking for JSON file at:', jsonPath);
    console.log('JSON file exists:', existsSync(jsonPath));
    
    if (existsSync(jsonPath)) {
      initMethod = 'JSON file';
      const serviceAccount = JSON.parse(readFileSync(jsonPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      throw new Error('Neither environment variables nor service-account.json file found');
    }
  }
  
  console.log(`Firebase Admin initialized successfully using ${initMethod}`);
} catch (error) {
  console.error('Failed to initialize Firebase Admin:', error.message);
  console.error('\nTroubleshooting:');
  console.error('1. For production: Set these environment variables in Render:');
  console.error('   - FIREBASE_PROJECT_ID');
  console.error('   - FIREBASE_CLIENT_EMAIL');
  console.error('   - FIREBASE_PRIVATE_KEY');
  console.error('2. For local development: Ensure service-account.json exists');
  
  // Log partial env var values for debugging (first 10 chars only)
  if (process.env.FIREBASE_PROJECT_ID) {
    console.error('PROJECT_ID preview:', process.env.FIREBASE_PROJECT_ID.substring(0, 10) + '...');
  }
  if (process.env.FIREBASE_CLIENT_EMAIL) {
    console.error('CLIENT_EMAIL preview:', process.env.FIREBASE_CLIENT_EMAIL.substring(0, 20) + '...');
  }
  if (process.env.FIREBASE_PRIVATE_KEY) {
    console.error('PRIVATE_KEY preview:', process.env.FIREBASE_PRIVATE_KEY.substring(0, 30) + '...');
  }
  
  process.exit(1);
}

// Middleware to verify Firebase ID tokens
export async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    // Verify the ID token
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Add user info to request object
    req.uid = decodedToken.uid;
    req.email = decodedToken.email;
    
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}