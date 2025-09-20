import { pipeline } from '@xenova/transformers';
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

const { Client } = pg;

// Sample documents to ingest (replace with your actual data)
const SAMPLE_DOCUMENTS = [
  {
    title: "Introduction to Machine Learning",
    content: "Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed. It focuses on developing computer programs that can access data and use it to learn for themselves."
  },
  {
    title: "Types of Machine Learning",
    content: "There are three main types of machine learning: Supervised learning uses labeled data to train models. Unsupervised learning finds patterns in unlabeled data. Reinforcement learning learns through interaction with an environment using rewards and penalties."
  },
  {
    title: "Neural Networks Basics",
    content: "Neural networks are computing systems inspired by biological neural networks. They consist of layers of interconnected nodes or neurons that process information. Deep learning uses neural networks with multiple hidden layers to learn complex patterns."
  },
  {
    title: "Natural Language Processing",
    content: "NLP is a branch of AI that helps computers understand, interpret and manipulate human language. It combines computational linguistics with machine learning and deep learning models to process and analyze large amounts of natural language data."
  },
  {
    title: "Computer Vision Fundamentals",
    content: "Computer vision is a field of AI that trains computers to interpret and understand the visual world. Using digital images from cameras and videos, machines can identify and classify objects and react to what they see."
  }
];

async function ingestDocuments() {
  console.log('Starting document ingestion...');
  
  // Connect to database
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
  
  await client.connect();
  console.log('Connected to database');
  
  // Load embedding model
  console.log('Loading embedding model...');
  const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  console.log('Model loaded');
  
  try {
    // Optional: Clear existing documents
    console.log('Clearing existing documents...');
    await client.query('DELETE FROM documents');
    
    // Process each document
    for (let i = 0; i < SAMPLE_DOCUMENTS.length; i++) {
      const doc = SAMPLE_DOCUMENTS[i];
      console.log(`Processing document ${i + 1}/${SAMPLE_DOCUMENTS.length}: ${doc.title}`);
      
      // Generate embedding
      const output = await embedder(doc.content, {
        pooling: 'mean',
        normalize: true
      });
      
      const embedding = Array.from(output.data);
      const vectorString = `[${embedding.join(',')}]`;
      
      // Insert into database
      const query = `
        INSERT INTO documents (title, content, embedding)
        VALUES ($1, $2, $3::vector)
      `;
      
      await client.query(query, [doc.title, doc.content, vectorString]);
      console.log(`✓ Inserted: ${doc.title}`);
    }
    
    // Verify insertion
    const countResult = await client.query('SELECT COUNT(*) FROM documents');
    console.log(`\nTotal documents in database: ${countResult.rows[0].count}`);
    
    console.log('\nIngestion completed successfully!');
    
  } catch (error) {
    console.error('Error during ingestion:', error);
  } finally {
    await client.end();
  }
}

// Function to ingest documents from text files in a directory
async function ingestFromFiles(directoryPath) {
  console.log(`Reading files from ${directoryPath}...`);
  
  const files = await fs.readdir(directoryPath);
  const textFiles = files.filter(f => f.endsWith('.txt'));
  
  const documents = [];
  
  for (const file of textFiles) {
    const filePath = path.join(directoryPath, file);
    const content = await fs.readFile(filePath, 'utf-8');
    const title = file.replace('.txt', '').replace(/_/g, ' ');
    
    documents.push({
      title: title,
      content: content.trim()
    });
    
    console.log(`Read file: ${file}`);
  }
  
  return documents;
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args[0] === '--files' && args[1]) {
    // Ingest from files: node ingest.js --files ./documents
    const documents = await ingestFromFiles(args[1]);
    SAMPLE_DOCUMENTS.length = 0;
    SAMPLE_DOCUMENTS.push(...documents);
  }
  
  await ingestDocuments();
  process.exit(0);
}

main().catch(console.error);