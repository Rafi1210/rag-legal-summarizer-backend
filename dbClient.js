import pg from 'pg';
const { Client } = pg;

// Create and connect to PostgreSQL client
let client = null;

export async function getDbClient() {
  if (!client) {
    client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false // Required for Supabase
      }
    });
    
    try {
      await client.connect();
      console.log('Connected to Supabase database');
    } catch (error) {
      console.error('Database connection error:', error);
      throw error;
    }
  }
  
  return client;
}

// Helper function to format vector for PostgreSQL
export function formatVector(vector) {
  return `[${vector.join(',')}]`;
}