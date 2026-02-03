import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createAIProvider } from './services/aiProviders.js';
import { DEFAULT_MODEL, ALL_MODELS } from './config/modelConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY;
const YANDEX_API_KEY = process.env.YANDEX_CLOUD_API_KEY;
const YANDEX_FOLDER_ID = process.env.YANDEX_CLOUD_FOLDER;


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

// Unified AI call helper
async function callAI({ prompt, systemPrompt, images = [], modelId = DEFAULT_MODEL }) {
  const provider = createAIProvider(modelId, {
    replicateApiKey: REPLICATE_API_KEY,
    yandexApiKey: YANDEX_API_KEY,
    yandexFolderId: YANDEX_FOLDER_ID
  });

  return await provider.generateText({ prompt, systemPrompt, images });
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

  // ===== API: GET AVAILABLE MODELS =====
  if (req.method === 'GET' && req.url?.startsWith('/api/available-models')) {
    try {
      // Parse query parameters
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const filter = urlObj.searchParams.get('filter');

      // Filter models based on available API keys
      let availableModels = ALL_MODELS.filter(model => {
        if (model.provider === 'replicate') {
          return !!REPLICATE_API_KEY;
        } else if (model.provider === 'yandex') {
          return !!YANDEX_API_KEY && !!YANDEX_FOLDER_ID;
        }
        return false;
      });

      // Apply capability filter if specified
      if (filter === 'images') {
        availableModels = availableModels.filter(m => m.capabilities?.images);
      } else if (filter === 'text') {
        // All models support text, no additional filtering needed
      }

      sendJSON(res, 200, {
        models: availableModels,
        defaultModel: filter === 'images' 
          ? availableModels.find(m => m.capabilities?.images)?.id || DEFAULT_MODEL
          : DEFAULT_MODEL
      });
    } catch (err) {
      console.error('Available Models API Error:', err.message);
      sendJSON(res, 500, { error: err.message });
    }
    return;
  }

  // ===== API: BRIEF PROCESSING (text only) =====
  if (req.method === 'POST' && req.url === '/api/brief') {
    try {
      const { text, systemPrompt, modelId } = await parseBody(req);
      console.log('Processing brief with model:', modelId || DEFAULT_MODEL);

      const result = await callAI({
        prompt: `Обработай следующий текст брифа согласно инструкциям и верни результат СТРОГО в формате JSON:\n\n${text}`,
        systemPrompt,
        modelId: modelId || DEFAULT_MODEL
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
      const { imageUrl, text, systemPrompt, modelId } = await parseBody(req);
      
      // Validate model supports images
      const selectedModelId = modelId || DEFAULT_MODEL;
      const modelConfig = ALL_MODELS.find(m => m.id === selectedModelId);
      if (modelConfig && !modelConfig.capabilities?.images) {
        throw new Error(`Model ${selectedModelId} does not support image analysis`);
      }
      
      console.log('Analyzing label with model:', selectedModelId);

      const result = await callAI({
        prompt: `ЭТАЛОН (EXCEL):\n${text}\n\nСравни это с изображением. Будь педантичен к регистру букв.`,
        systemPrompt,
        images: [imageUrl],
        modelId: selectedModelId
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
      const { imageUrl, systemPrompt, modelId } = await parseBody(req);
      
      // Validate model supports images
      const selectedModelId = modelId || DEFAULT_MODEL;
      const modelConfig = ALL_MODELS.find(m => m.id === selectedModelId);
      if (modelConfig && !modelConfig.capabilities?.images) {
        throw new Error(`Model ${selectedModelId} does not support image analysis`);
      }
      
      console.log('Proofreading label with model:', selectedModelId);

      const result = await callAI({
        prompt: 'Найди все орфографические и пунктуационные ошибки на изображении.',
        systemPrompt,
        images: [imageUrl],
        modelId: selectedModelId
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
