import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4173;

// Artemox API configuration
const ARTEMOX_API_KEY = process.env.API_KEY || 'sk-q__BVWFUdOxIdfAf6pWnrg';
const ARTEMOX_BASE_URL = 'https://api.artemox.com/v1';

// Middleware
app.use(express.json({ limit: '50mb' }));

// API proxy endpoint
app.post('/api/analyze', async (req, res) => {
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
    res.json(data);
  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Serve static files from the dist directory
app.use(express.static(join(__dirname, 'dist')));

// SPA fallback - serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

