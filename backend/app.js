const express = require('express');
const cors = require('cors');

const app = express();

// Enhanced CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:5173', // Vite dev server
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173', // Vite dev server
    'https://purple-desert-0c35a1000.2.azurestaticapps.net',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Scan-ID', 'X-Device-ID'],
  optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));

// Request timeout middleware
app.use((req, res, next) => {
  // Set timeout for all requests (30 seconds)
  req.setTimeout(30000, () => {
    const err = new Error('Request timeout');
    err.status = 408;
    next(err);
  });
  
  res.setTimeout(30000, () => {
    const err = new Error('Response timeout');
    err.status = 408;
    next(err);
  });
  
  next();
});

app.use(express.json({ limit: '10mb' })); // Add size limit for JSON payloads
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Add size limit for URL encoded

// Request logging middleware for debugging
app.use((req, res, next) => {
  const start = Date.now();
  const requestId = Math.random().toString(36).substr(2, 9);
  
  req.requestId = requestId;
  console.log(`[${requestId}] ${new Date().toISOString()} - ${req.method} ${req.url}`);
  
  // Log response time
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${requestId}] Response completed in ${duration}ms - Status: ${res.statusCode}`);
  });
  
  next();
});

// Import routes (Boundary layer)
const participantsRoutes = require('./routes/participantsRoutes');

// Routes middleware
app.use('/participants', participantsRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    requestId: req.requestId
  });
});

// API status endpoint
app.get('/api/status', (req, res) => {
  res.status(200).json({ 
    status: 'API is running',
    version: '1.0.0',
    endpoints: ['/participants', '/health', '/api/status'],
    timestamp: new Date().toISOString()
  });
});

// Enhanced error handling middleware
app.use((err, req, res, next) => {
  const requestId = req.requestId || 'unknown';
  console.error(`[${requestId}] Error:`, err.stack);
  
  // Handle specific error types
  if (err.name === 'MongoServerSelectionError') {
    return res.status(503).json({ 
      error: 'Database connection error',
      message: 'Please try again in a moment',
      requestId: requestId
    });
  }
  
  if (err.message === 'Request timeout' || err.message === 'Response timeout') {
    return res.status(408).json({ 
      error: 'Request timeout',
      message: 'The request took too long to process. Please try again.',
      requestId: requestId
    });
  }
  
  if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
    return res.status(408).json({ 
      error: 'Connection timeout',
      message: 'Connection timed out. Please check your network and try again.',
      requestId: requestId
    });
  }
  
  // Default error response
  res.status(err.status || 500).json({ 
    error: 'Something went wrong!',
    message: err.message || 'Internal server error',
    requestId: requestId
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

module.exports = app;
