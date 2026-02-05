import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createAIProvider } from './services/aiProviders.js';
import { DEFAULT_MODEL, ALL_MODELS } from './config/modelConfig.js';
import { COMPARISON_SYSTEM_PROMPT, BRIEF_PROMPTS, FINAL_CHECK_SYSTEM_PROMPT, savePrompts, reloadPrompts, getPromptsETag, getPromptsMetadata } from './services/prompts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY;
const YANDEX_API_KEY = process.env.YANDEX_CLOUD_API_KEY;
const YANDEX_FOLDER_ID = process.env.YANDEX_CLOUD_FOLDER;

// === БЕЗОПАСНОСТЬ: API Аутентификация ===
const API_SECRET = process.env.API_SECRET || 'dev-secret-change-me';
const NODE_ENV = process.env.NODE_ENV || 'development';


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

// === БЕЗОПАСНОСТЬ: Middleware для проверки API ключа ===
function requireApiAuth(req, res) {
  // В development режиме пропускаем проверку для удобства
  if (NODE_ENV === 'development') return true;

  // Получаем ключ из заголовка X-API-Key
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== API_SECRET) {
    sendJSON(res, 401, { error: 'Неавторизован: Неверный или отсутствующий API ключ' });
    return false;
  }

  return true;
}

// === БЕЗОПАСНОСТЬ: Rate Limiting ===
const rateLimitMap = new Map(); // IP адрес → {count, resetTime}
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 минут в миллисекундах
const RATE_LIMIT_MAX = 20; // 20 запросов на IP за 15 минут

function checkRateLimit(req, res) {
  // Получаем IP адрес клиента
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0] ||
                   req.socket.remoteAddress;

  const now = Date.now();
  const record = rateLimitMap.get(clientIp) || {
    count: 0,
    resetTime: now + RATE_LIMIT_WINDOW
  };

  // Сбрасываем счетчик если окно истекло
  if (now > record.resetTime) {
    record.count = 0;
    record.resetTime = now + RATE_LIMIT_WINDOW;
  }

  record.count++;
  rateLimitMap.set(clientIp, record);

  // Проверяем лимит
  if (record.count > RATE_LIMIT_MAX) {
    const waitMinutes = Math.ceil((record.resetTime - now) / 60000);
    sendJSON(res, 429, {
      error: `Слишком много запросов. Подождите ${waitMinutes} минут.`
    });
    return false;
  }

  return true;
}

// Очистка старых записей каждый час (экономим память)
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetTime + RATE_LIMIT_WINDOW) {
      rateLimitMap.delete(ip);
    }
  }
}, 60 * 60 * 1000);

// === БЕЗОПАСНОСТЬ: Валидация Входных Данных ===
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB в байтах
const MAX_TEXT_LENGTH = 50000; // 50,000 символов

function validateInput(body, requiredFields) {
  // Проверка обязательных полей
  for (const field of requiredFields) {
    if (!body[field]) {
      return {
        valid: false,
        error: `Отсутствует обязательное поле: ${field}`
      };
    }
  }

  // Проверка длины текста
  if (body.text && body.text.length > MAX_TEXT_LENGTH) {
    return {
      valid: false,
      error: `Текст слишком длинный (максимум ${MAX_TEXT_LENGTH} символов)`
    };
  }

  // Проверка imageUrl (должен быть data URI)
  if (body.imageUrl) {
    if (!body.imageUrl.startsWith('data:image/')) {
      return {
        valid: false,
        error: 'Неверный формат изображения'
      };
    }

    // Проверка размера base64 (примерно)
    // Base64 увеличивает размер на ~33%, поэтому умножаем на 1.4
    if (body.imageUrl.length > MAX_FILE_SIZE * 1.4) {
      return {
        valid: false,
        error: 'Изображение слишком большое (максимум 10 MB)'
      };
    }
  }

  return { valid: true };
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
      sendJSON(res, 500, { error: 'Не удалось загрузить модели. Попробуйте позже.' });
    }
    return;
  }

  // ===== API: BRIEF PROCESSING (text only) =====
  if (req.method === 'POST' && req.url === '/api/brief') {
    if (!checkRateLimit(req, res)) return;
    if (!requireApiAuth(req, res)) return;

    try {
      const { text, briefType, modelId } = await parseBody(req);

      // Валидация
      const validation = validateInput({ text }, ['text']);
      if (!validation.valid) {
        return sendJSON(res, 400, { error: validation.error });
      }

      // Сервер выбирает промпт, клиент не отправляет его
      const systemPrompt = BRIEF_PROMPTS[briefType] || BRIEF_PROMPTS.food;

      if (NODE_ENV === 'development') {
        console.log('Processing brief with model:', modelId || DEFAULT_MODEL, 'type:', briefType);
      }

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
      sendJSON(res, 500, { error: 'Не удалось обработать бриф. Проверьте формат данных.' });
    }
    return;
  }

  // ===== API: LABEL COMPARISON (image + text) =====
  if (req.method === 'POST' && req.url === '/api/analyze') {
    if (!checkRateLimit(req, res)) return;
    if (!requireApiAuth(req, res)) return;

    try {
      const { imageUrl, text, modelId } = await parseBody(req);

      // Валидация
      const validation = validateInput({ imageUrl, text }, ['imageUrl', 'text']);
      if (!validation.valid) {
        return sendJSON(res, 400, { error: validation.error });
      }

      // Сервер использует свой промпт
      const systemPrompt = COMPARISON_SYSTEM_PROMPT;

      // Validate model supports images
      const selectedModelId = modelId || DEFAULT_MODEL;
      const modelConfig = ALL_MODELS.find(m => m.id === selectedModelId);
      if (modelConfig && !modelConfig.capabilities?.images) {
        throw new Error(`Model ${selectedModelId} does not support image analysis`);
      }

      if (NODE_ENV === 'development') {
        console.log('Analyzing label with model:', selectedModelId);
      }

      const result = await callAI({
        prompt: `ЭТАЛОН (EXCEL):\n${text}\n\nСравни это с изображением. Будь педантичен к регистру букв.`,
        systemPrompt,
        images: [imageUrl],
        modelId: selectedModelId
      });
      
      sendJSON(res, 200, { result });
    } catch (err) {
      console.error('Analyze API Error:', err.message);
      sendJSON(res, 500, { error: 'Не удалось проанализировать этикетку.' });
    }
    return;
  }

  // ===== API: FINAL PROOFREAD (image only) =====
  if (req.method === 'POST' && req.url === '/api/proofread') {
    if (!checkRateLimit(req, res)) return;
    if (!requireApiAuth(req, res)) return;

    try {
      const { imageUrl, modelId } = await parseBody(req);

      // Валидация
      const validation = validateInput({ imageUrl }, ['imageUrl']);
      if (!validation.valid) {
        return sendJSON(res, 400, { error: validation.error });
      }

      // Сервер использует свой промпт
      const systemPrompt = FINAL_CHECK_SYSTEM_PROMPT;

      // Validate model supports images
      const selectedModelId = modelId || DEFAULT_MODEL;
      const modelConfig = ALL_MODELS.find(m => m.id === selectedModelId);
      if (modelConfig && !modelConfig.capabilities?.images) {
        throw new Error(`Model ${selectedModelId} does not support image analysis`);
      }

      if (NODE_ENV === 'development') {
        console.log('Proofreading label with model:', selectedModelId);
      }

      const result = await callAI({
        prompt: 'Найди все орфографические и пунктуационные ошибки на изображении.',
        systemPrompt,
        images: [imageUrl],
        modelId: selectedModelId
      });
      
      sendJSON(res, 200, { result });
    } catch (err) {
      console.error('Proofread API Error:', err.message);
      sendJSON(res, 500, { error: 'Не удалось проверить этикетку.' });
    }
    return;
  }

  // ===== API: GET PROMPTS =====
  if (req.method === 'GET' && req.url === '/api/prompts') {
    if (!requireApiAuth(req, res)) return;

    try {
      const metadata = getPromptsMetadata();

      // 🔒 Отправляем ETag в заголовке (стандарт HTTP)
      res.setHeader('ETag', metadata.etag);

      // И в теле ответа (для удобства клиента)
      sendJSON(res, 200, {
        prompts: metadata.prompts,
        etag: metadata.etag,
        lastModified: metadata.lastModified
      });
    } catch (err) {
      console.error('Get Prompts API Error:', err.message);
      sendJSON(res, 500, { error: 'Не удалось загрузить промпты' });
    }
    return;
  }

  // ===== API: UPDATE PROMPTS =====
  if (req.method === 'POST' && req.url === '/api/prompts') {
    if (!checkRateLimit(req, res)) return;
    if (!requireApiAuth(req, res)) return;

    try {
      const { prompts, etag: clientETag } = await parseBody(req);

      // Валидация
      if (!prompts || typeof prompts !== 'object') {
        return sendJSON(res, 400, { error: 'Неверный формат промптов' });
      }

      // 🔒 OPTIMISTIC LOCKING: Проверка ETag для защиты от race conditions
      const currentETag = getPromptsETag();

      if (clientETag && clientETag !== currentETag) {
        // Конфликт! Промпты были изменены другим пользователем
        const currentMetadata = getPromptsMetadata();

        return sendJSON(res, 409, {
          error: 'Конфликт: Промпты были изменены другим пользователем',
          message: 'Пожалуйста, обновите страницу и повторите редактирование',
          currentETag: currentMetadata.etag,
          currentPrompts: currentMetadata.prompts,
          lastModified: currentMetadata.lastModified
        });
      }

      // Проверка наличия всех ключей
      const requiredKeys = ['food', 'nonfood', 'inter', 'ge'];
      for (const key of requiredKeys) {
        if (!prompts[key] || typeof prompts[key] !== 'string') {
          return sendJSON(res, 400, { error: `Отсутствует промпт: ${key}` });
        }

        // Проверка размера (100KB макс на промпт)
        if (prompts[key].length > 100000) {
          return sendJSON(res, 400, { error: `Промпт ${key} слишком большой (максимум 100KB)` });
        }
      }

      // Сохранить промпты в файл
      savePrompts(prompts);

      // Перезагрузить промпты в память
      reloadPrompts();

      // Получить новый ETag после сохранения
      const newMetadata = getPromptsMetadata();

      if (NODE_ENV === 'development') {
        console.log('Prompts updated successfully. New ETag:', newMetadata.etag);
      }

      sendJSON(res, 200, {
        success: true,
        message: 'Промпты успешно обновлены',
        etag: newMetadata.etag,
        lastModified: newMetadata.lastModified
      });
    } catch (err) {
      console.error('Update Prompts API Error:', err.message);
      sendJSON(res, 500, { error: 'Не удалось сохранить промпты' });
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
