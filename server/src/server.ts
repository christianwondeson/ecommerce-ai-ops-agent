import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { apiRouter } from './routes/api.routes.js';
import { schedulerService } from './services/scheduler.service.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRouter);

// Root Welcome & API Index
app.get('/', (req, res) => {
  res.json({
    service: 'Autonomous E-Commerce Operations Specialist API',
    status: 'online',
    version: '1.0.0',
    documentation: 'https://github.com/christianwondeson/ecommerce-ai-ops-agent',
    endpoints: {
      health: '/health',
      inventory: '/api/inventory',
      orders: '/api/orders',
      auditLogs: '/api/audit-logs',
      scheduler: '/api/scheduler',
      chat: '/api/agent/chat',
      webhook: '/api/courier/webhook',
    },
  });
});

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Autonomous E-Commerce Operations Specialist Backend',
    timestamp: new Date().toISOString(),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here'),
  });
});

// Boot Server
app.listen(PORT, () => {
  console.log(`
  ===================================================================
  🚀 AUTONOMOUS E-COMMERCE OPERATIONS SPECIALIST (BACKEND READY)
  ===================================================================
  • Server listening on:  http://localhost:${PORT}
  • Health endpoint:      http://localhost:${PORT}/health
  • Gemini Status:        ${process.env.GEMINI_API_KEY ? 'API Key Configured' : 'Simulated / Free Tier Fallback'}
  • Proactive Scheduler:  Active (node-cron engine initialized)
  ===================================================================
  `);

  // Start background cron engine
  schedulerService.init();
});
