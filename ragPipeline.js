import { pipeline } from '@xenova/transformers';
import { getDbClient, formatVector } from './dbClient.js';

// Initialize the embedding model (runs locally in Node.js)
let embedder = null;

async function getEmbedder() {
  if (!embedder) {
    console.log('Loading embedding model...');
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log('Embedding model loaded');
  }
  return embedder;
}

// Function to generate embeddings for text
async function generateEmbedding(text) {
  const embedModel = await getEmbedder();
  
  // Generate embedding
  const output = await embedModel(text, { 
    pooling: 'mean', 
    normalize: true 
  });
  
  // Convert to array
  return Array.from(output.data);
}

// Main RAG function to process questions
export async function askQuestion(question, userId) {
  const db = await getDbClient();
  
  try {
    // 1. Generate embedding for the question
    console.log('Generating embedding for question...');
    const questionEmbedding = await generateEmbedding(question);
    const vectorString = formatVector(questionEmbedding);
    
    // 2. Find similar documents using pgvector
    console.log('Searching for similar documents...');
    const searchQuery = `
      SELECT 
        id,
        title,
        content,
        1 - (embedding <=> $1::vector) as similarity
      FROM documents
      ORDER BY embedding <=> $1::vector
      LIMIT 5
    `;
    
    const searchResult = await db.query(searchQuery, [vectorString]);
    
    // 3. Log the query to history
    const historyQuery = `
      INSERT INTO user_queries (user_id, question, answer)
      VALUES ($1, $2, $3)
      RETURNING id
    `;
    
    let answer = '';
    
    if (searchResult.rows.length === 0) {
      answer = 'No relevant information found in the knowledge base.';
    } else {
      // Format the context from retrieved documents
      const contexts = searchResult.rows.map((doc, idx) => {
        const similarity = (doc.similarity * 100).toFixed(1);
        return `[Document ${idx + 1} - ${similarity}% match]\n${doc.title || 'Untitled'}\n${doc.content}`;
      });
      
      answer = `Based on the knowledge base, here are the most relevant passages:\n\n${contexts.join('\n\n---\n\n')}`;
      
      // Optional: If you have OpenAI API key, you can generate a better answer
      // answer = await generateAnswerWithGPT(question, contexts.join('\n\n'));
    }
    
    await db.query(historyQuery, [userId, question, answer]);
    
    return answer;
    
  } catch (error) {
    console.error('Error in askQuestion:', error);
    throw error;
  }
}

// Function to get user's question history
export async function getUserHistory(userId) {
  const db = await getDbClient();
  
  try {
    const query = `
      SELECT id, question, answer, asked_at
      FROM user_queries
      WHERE user_id = $1
      ORDER BY asked_at DESC
      LIMIT 50
    `;
    
    const result = await db.query(query, [userId]);
    return result.rows;
    
  } catch (error) {
    console.error('Error in getUserHistory:', error);
    throw error;
  }
}

// Optional: Function to generate answer using OpenAI GPT
async function generateAnswerWithGPT(question, context) {
  // Only use if you have OPENAI_API_KEY in .env
  if (!process.env.OPENAI_API_KEY) {
    return context;
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant. Answer the question based on the provided context.'
          },
          {
            role: 'user',
            content: `Context:\n${context}\n\nQuestion: ${question}\n\nProvide a clear and concise answer based on the context.`
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });
    
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error calling OpenAI:', error);
    return context; // Fallback to raw context
  }
}