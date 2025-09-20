import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { verifyToken } from './authMiddleware.js';
import { askQuestion, getUserHistory } from './ragPipeline.js';

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Ask a question endpoint (protected)
app.post('/ask', verifyToken, async (req, res) => {
  try {
    const { question } = req.body;
    const userId = req.uid; // from Firebase auth middleware

    if (!question || question.trim().length === 0) {
      return res.status(400).json({ error: 'Question is required' });
    }

    console.log(`User ${userId} asked: ${question}`);

    // Process question and get answer
    const answer = await askQuestion(question, userId);
    
    res.json({ answer, success: true });
  } catch (error) {
    console.error('Error in /ask endpoint:', error);
    res.status(500).json({ 
      error: 'Failed to process question', 
      details: error.message 
    });
  }
});

// Get user's question history (protected)
app.get('/history', verifyToken, async (req, res) => {
  try {
    const userId = req.uid;
    const queries = await getUserHistory(userId);
    res.json({ queries, success: true });
  } catch (error) {
    console.error('Error in /history endpoint:', error);
    res.status(500).json({ 
      error: 'Failed to fetch history', 
      details: error.message 
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});