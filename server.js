import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const distPath = join(__dirname, 'dist');

console.log('=== Server Starting ===');
console.log('PORT:', PORT);
console.log('__dirname:', __dirname);
console.log('distPath:', distPath);
console.log('dist exists:', existsSync(distPath));
console.log('index.html exists:', existsSync(join(distPath, 'index.html')));

// Artemox API configuration
const ARTEMOX_API_KEY = process.env.API_KEY || 'sk-q__BVWFUdOxIdfAf6pWnrg';
const ARTEMOX_BASE_URL = 'https://api.artemox.com/v1';

// Middleware
app.use(express.json({ limit: '50mb' }));

// Health check - MUST respond immediately
app.get('/health', (req, res) => {
  console.log('Health check hit');
  res.status(200).send('OK');
});

// Root path health check (Railway might check this)
app.get('/', (req, res, next) => {
  // If dist exists, serve index.html, otherwise respond with OK for health check
  const indexPath = join(distPath, 'index.html');
  if (existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  console.log('Warning: index.html not found, returning health OK');
  res.status(200).send('Server is running, but dist not found. Run npm run build first.');
});

// API proxy endpoint
app.post('/api/analyze', async (req, res) => {
  console.log('API analyze request received');
  try {
    const { model, messages, temperature } = req.body;

    const response = await fetch(`${ARTEMOX_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ARTEMOX_API_KEY}`,
      },
      body: JSON.stringify({
        model: model || 'gemini-2.5-flash',
        messages,
        temperature: temperature ?? 0,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Artemox API Error:', response.status, errorText);
      return res.status(response.status).json({ 
        error: `API Error: ${response.status}`,
        details: errorText 
      });
    }

    const data = await response.json();
    console.log('Artemox API success');
    res.json(data);
  } catch (error) {
    console.error('Proxy Error:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Serve static files only if dist exists
if (existsSync(distPath)) {
  console.log('Serving static files from dist');
  app.use(express.static(distPath));
  
  // SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
} else {
  console.log('WARNING: dist folder not found! Run npm run build');
}

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`=== Server ready on port ${PORT} ===`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
