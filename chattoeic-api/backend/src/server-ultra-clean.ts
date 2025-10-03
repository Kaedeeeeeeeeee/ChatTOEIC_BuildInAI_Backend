import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import Joi from 'joi';

// Load environment variables
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Basic middleware
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0-ULTRA-CLEAN-FIXED',
    message: 'timeLimit validation FIXED!'
  });
});

// Question generation with WORKING timeLimit validation
const questionSchema = Joi.object({
  type: Joi.string().valid(
    'LISTENING_PART1', 'LISTENING_PART2', 'LISTENING_PART3', 'LISTENING_PART4',
    'READING_PART5', 'READING_PART6', 'READING_PART7'
  ).required(),
  difficulty: Joi.string().valid(
    'BEGINNER', 'INTERMEDIATE', 'ADVANCED',
    'LEVEL_400_500', 'LEVEL_500_600', 'LEVEL_600_700', 'LEVEL_700_800', 'LEVEL_800_900'
  ).required(),
  count: Joi.number().integer().min(1).max(20).required(),
  timeLimit: Joi.number().integer().min(0).optional() // ✅ FIXED!
});

app.post('/api/questions/generate', async (req, res) => {
  try {
    console.log('🎯 ULTRA CLEAN: Question generation request:', req.body);

    // Validate with timeLimit support
    const { error } = questionSchema.validate(req.body);
    if (error) {
      console.log('❌ Validation failed:', error.details);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(d => d.message)
      });
    }

    const { type, difficulty, count, timeLimit } = req.body;
    console.log('✅ ULTRA CLEAN: Validation passed! timeLimit:', timeLimit);

    // Mock successful response
    const questions = Array.from({ length: count }, (_, i) => ({
      id: `q_${i + 1}`,
      type,
      difficulty,
      question: `ULTRA CLEAN Mock ${type} question ${i + 1}`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: 'A',
      explanation: 'Mock explanation for testing',
      timeLimit: timeLimit || 600
    }));

    res.json({
      success: true,
      data: {
        questions,
        debug: {
          version: '1.0.0-ULTRA-CLEAN-FIXED',
          timeLimit: timeLimit,
          validationPassed: true,
          message: 'timeLimit parameter accepted successfully!'
        }
      }
    });

  } catch (error) {
    console.error('💥 Error:', error);
    res.status(500).json({
      success: false,
      error: 'Generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'ChatTOEIC API - ULTRA CLEAN',
    version: '1.0.0-ULTRA-CLEAN-FIXED',
    status: 'running',
    timestamp: new Date().toISOString(),
    features: ['timeLimit-validation-FIXED']
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 ChatTOEIC ULTRA CLEAN API Started!');
  console.log(`📡 Address: http://localhost:${PORT}`);
  console.log(`✅ Version: 1.0.0-ULTRA-CLEAN-FIXED`);
  console.log(`🎯 timeLimit validation: WORKING!`);
});

export default app;