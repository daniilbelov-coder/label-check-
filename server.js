import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY;

// Google Gemini 2.5 Flash on Replicate
const MODEL_VERSION = 'bfb7df9586ae4fafa00a593d8dc4868698f72cf9d695da28b8c8a70f88e876ba';

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// Wait for Replicate prediction to complete
async function waitForPrediction(predictionId) {
  const maxAttempts = 120;
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { 'Authorization': `Bearer ${REPLICATE_API_KEY}` },
    });
    const prediction = await response.json();
    
    console.log(`Prediction status: ${prediction.status}`);
    
    if (prediction.status === 'succeeded') {
      return prediction.output;
    } else if (prediction.status === 'failed' || prediction.status === 'canceled') {
      throw new Error(prediction.error || 'Prediction failed');
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error('Prediction timeout');
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/analyze') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const { imageUrl, prompt, systemPrompt } = data;

        console.log('Creating Gemini prediction...');

        // Create prediction with Gemini 2.5 Flash
        const createResponse = await fetch('https://api.replicate.com/v1/predictions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${REPLICATE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            version: MODEL_VERSION,
            input: {
              prompt: prompt,
              images: [imageUrl],
              system_instruction: systemPrompt,
              temperature: 0.1,
              max_output_tokens: 8192,
            },
          }),
        });

        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          console.error('Replicate API Error:', createResponse.status, errorText);
          res.writeHead(createResponse.status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: errorText }));
          return;
        }

        const prediction = await createResponse.json();
        console.log('Prediction created:', prediction.id);
        
        // Wait for completion
        const output = await waitForPrediction(prediction.id);
        
        // Output format depends on the model
        const resultText = typeof output === 'string' ? output : (Array.isArray(output) ? output.join('') : JSON.stringify(output));
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ result: resultText }));
      } catch (err) {
        console.error('API Error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  let filePath = path.join(__dirname, 'dist', req.url === '/' ? 'index.html' : req.url);
  if (!fs.existsSync(filePath)) filePath = path.join(__dirname, 'dist', 'index.html');

  try {
    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(content);
  } catch (err) {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
