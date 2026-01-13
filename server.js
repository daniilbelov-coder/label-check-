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
  const maxAttempts = 180; // 6 minutes max
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { 'Authorization': `Bearer ${REPLICATE_API_KEY}` },
    });
    const prediction = await response.json();
    
    if (prediction.status === 'succeeded') {
      return prediction.output;
    } else if (prediction.status === 'failed' || prediction.status === 'canceled') {
      throw new Error(prediction.error || 'Prediction failed');
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error('Prediction timeout');
}

// Generic Gemini call helper
async function callGemini({ prompt, systemPrompt, images = [], responseFormat = null }) {
  const input = {
    prompt,
    temperature: 0.1,
    max_output_tokens: 8192,
  };
  
  if (systemPrompt) input.system_instruction = systemPrompt;
  if (images.length > 0) input.images = images;

  const createResponse = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${REPLICATE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ version: MODEL_VERSION, input }),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(`Replicate API Error: ${errorText}`);
  }

  const prediction = await createResponse.json();
  const output = await waitForPrediction(prediction.id);
  
  return typeof output === 'string' ? output : (Array.isArray(output) ? output.join('') : JSON.stringify(output));
}

// Parse request body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// Send JSON response
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  
  // ===== API: BRIEF PROCESSING (text only) =====
  if (req.method === 'POST' && req.url === '/api/brief') {
    try {
      const { text, systemPrompt } = await parseBody(req);
      console.log('Processing brief...');
      
      const result = await callGemini({
        prompt: `Обработай следующий текст брифа согласно инструкциям и верни результат СТРОГО в формате JSON:\n\n${text}`,
        systemPrompt,
      });
      
      // Try to parse JSON from response
      let parsed;
      try {
        // Find JSON in the response (might be wrapped in markdown code blocks)
        const jsonMatch = result.match(/```json\s*([\s\S]*?)\s*```/) || result.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : result;
        parsed = JSON.parse(jsonStr);
      } catch {
        parsed = { "Результат": result };
      }
      
      sendJSON(res, 200, { result: parsed });
    } catch (err) {
      console.error('Brief API Error:', err.message);
      sendJSON(res, 500, { error: err.message });
    }
    return;
  }

  // ===== API: LABEL COMPARISON (image + text) =====
  if (req.method === 'POST' && req.url === '/api/analyze') {
    try {
      const { imageUrl, text, systemPrompt } = await parseBody(req);
      console.log('Analyzing label...');
      
      const result = await callGemini({
        prompt: `ЭТАЛОН (EXCEL):\n${text}\n\nСравни это с изображением. Будь педантичен к регистру букв.`,
        systemPrompt,
        images: [imageUrl],
      });
      
      sendJSON(res, 200, { result });
    } catch (err) {
      console.error('Analyze API Error:', err.message);
      sendJSON(res, 500, { error: err.message });
    }
    return;
  }

  // ===== API: FINAL PROOFREAD (image only) =====
  if (req.method === 'POST' && req.url === '/api/proofread') {
    try {
      const { imageUrl, systemPrompt } = await parseBody(req);
      console.log('Proofreading label...');
      
      const result = await callGemini({
        prompt: 'Найди все орфографические и пунктуационные ошибки на изображении.',
        systemPrompt,
        images: [imageUrl],
      });
      
      sendJSON(res, 200, { result });
    } catch (err) {
      console.error('Proofread API Error:', err.message);
      sendJSON(res, 500, { error: err.message });
    }
    return;
  }

  // ===== STATIC FILES =====
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
