import pg from 'pg';

const { Pool } = pg;

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Get database client
export async function getDbClient() {
  return pool;
}

// Format vector for PostgreSQL
export function formatVector(embedding) {
  return `[${embedding.join(',')}]`;
}

// Initialize database tables
export async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('Initializing database tables...');
    
    // Enable pgvector extension
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    
    // Create documents table for storing knowledge base
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        title TEXT,
        content TEXT NOT NULL,
        embedding vector(384), -- all-MiniLM-L6-v2 produces 384-dimensional embeddings
        source_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create user_queries table for storing user interactions
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_queries (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        asked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create indexes for better performance
    // Note: IVFFlat index creation might fail if there aren't enough vectors
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_documents_embedding 
        ON documents USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
      `);
    } catch (indexError) {
      console.log('Could not create IVFFlat index (normal if no documents exist yet)');
      // Create a simple index instead
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_documents_id ON documents(id)
      `);
    }
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_queries_user_id 
      ON user_queries(user_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_queries_asked_at 
      ON user_queries(asked_at DESC)
    `);
    
    console.log('Database tables initialized successfully');
    
    // Check if we have any documents
    const docCount = await client.query('SELECT COUNT(*) FROM documents');
    console.log(`Documents in knowledge base: ${docCount.rows[0].count}`);
    
    if (docCount.rows[0].count === '0') {
      console.log('No documents found. Run "node ingest.js" to populate the knowledge base.');
    }
    
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
}