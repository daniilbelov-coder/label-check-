import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_MODEL, ALL_MODELS } from './config/modelConfig.js';
import { COMPARISON_SYSTEM_PROMPT, BRIEF_PROMPTS, FINAL_CHECK_SYSTEM_PROMPT, TEXT_CHECK_SYSTEM_PROMPT, savePrompts, reloadPrompts, getPromptsETag, getPromptsMetadata } from './services/prompts.js';
import { FABRIKA_QA_SYSTEM_PROMPT, FABRIKA_SIGN_CHECK_PROMPT } from './services/fabrikaPrompts.js';
import { callAI } from './services/callAI.js';
import { fabrikaMergeReport as mergeFabrikaReport } from './utils/fabrikaMergeReport.js';
import busboy from 'busboy';
import JSZip from 'jszip';
import { createJobStore } from './services/fabrikaJobStore.js';
import { runJob, retryRow } from './services/fabrikaWorker.js';
import { parseBrandSpec, matchPdfsToColumns, buildSpecText } from './services/xlsxSpecParser.js';
import { extractFabrikaSigns } from './services/xlsxMedia.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
if (nodeMajor < 18) {
  console.error(`\n[FATAL] Node.js >= 18 required (pdfjs-dist 4.x uses ES2021 syntax like ||=).`);
  console.error(`Current: ${process.version}. Use \`nvm use 20\` or similar and restart.\n`);
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY;
const YANDEX_API_KEY = process.env.YANDEX_CLOUD_API_KEY;
const YANDEX_FOLDER_ID = process.env.YANDEX_CLOUD_FOLDER;

// === БЕЗОПАСНОСТЬ: API Аутентификация ===
const API_SECRET = process.env.API_SECRET || 'dev-secret-change-me';
const NODE_ENV = process.env.NODE_ENV || 'development';

const fabrikaJobStore = createJobStore();
const fabrikaJobAssets = new Map(); // jobId -> { pdfBuffers, signs }

function parseFabrikaMultipart(req) {
  return new Promise((resolve, reject) => {
    const bb = busboy({ headers: req.headers, limits: { fileSize: 500 * 1024 * 1024 } });
    const files = {};
    const fields = {};
    const pending = [];
    let truncated = null;
    bb.on('file', (name, stream, info) => {
      pending.push(new Promise((res, rej) => {
        const chunks = [];
        stream.on('data', (c) => chunks.push(c));
        stream.on('limit', () => { truncated = `${name} (${info?.filename ?? ''}) exceeds size limit`; });
        stream.on('end', () => { files[name] = Buffer.concat(chunks); res(); });
        stream.on('error', rej);
      }));
    });
    bb.on('field', (name, val) => { fields[name] = val; });
    bb.on('close', async () => {
      try {
        await Promise.all(pending);
        if (truncated) return reject(new Error(truncated));
        resolve({ files, fields });
      } catch (err) { reject(err); }
    });
    bb.on('error', reject);
    req.pipe(bb);
  });
}


const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

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
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB на одно изображение (data URI base64)
const MAX_TEXT_LENGTH = 150000; // 150,000 символов для длинных ТЗ Fabrika
const MAX_IMAGES_TOTAL = 20;
const MAX_IMAGES_TOTAL_BYTES = 60 * 1024 * 1024; // ~45 МБ полезной нагрузки

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

function validateFabrikaInput(body) {
  if (typeof body.excelText !== 'string' || body.excelText.trim().length === 0) {
    return { valid: false, error: 'Отсутствует excelText' };
  }
  if (body.excelText.length > MAX_TEXT_LENGTH) {
    return { valid: false, error: `excelText слишком длинный (максимум ${MAX_TEXT_LENGTH})` };
  }
  if (!Array.isArray(body.pdfPages) || body.pdfPages.length === 0) {
    return { valid: false, error: 'pdfPages пуст' };
  }
  if (!Array.isArray(body.signs)) {
    return { valid: false, error: 'signs не массив' };
  }
  const totalImages = body.pdfPages.length + body.signs.length;
  if (totalImages > MAX_IMAGES_TOTAL) {
    return { valid: false, error: `Слишком много изображений: ${totalImages} (максимум ${MAX_IMAGES_TOTAL})` };
  }

  let totalBytes = 0;
  const checkDataUri = (uri, label) => {
    if (typeof uri !== 'string' || !uri.startsWith('data:image/')) {
      return `Неверный формат ${label}`;
    }
    if (uri.length > MAX_FILE_SIZE * 1.4) {
      return `${label} превышает ${MAX_FILE_SIZE} байт`;
    }
    totalBytes += uri.length;
    return null;
  };

  for (let i = 0; i < body.pdfPages.length; i++) {
    const err = checkDataUri(body.pdfPages[i], `pdfPages[${i}]`);
    if (err) return { valid: false, error: err };
  }
  for (let i = 0; i < body.signs.length; i++) {
    const s = body.signs[i];
    if (!s || typeof s.name !== 'string') return { valid: false, error: `signs[${i}].name отсутствует` };
    const err = checkDataUri(s.dataUrl, `signs[${i}].dataUrl`);
    if (err) return { valid: false, error: err };
  }
  if (totalBytes > MAX_IMAGES_TOTAL_BYTES) {
    return { valid: false, error: 'Суммарный размер изображений слишком большой' };
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

      // Apply filter if specified
      if (filter === 'images') {
        // Gemini supports images
        availableModels = availableModels.filter(m => m.provider === 'replicate');
      }

      sendJSON(res, 200, {
        models: availableModels,
        defaultModel: DEFAULT_MODEL
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

    let requestModelId = DEFAULT_MODEL;
    try {
      const { text, briefType, modelId } = await parseBody(req);
      requestModelId = modelId || DEFAULT_MODEL;

      const validation = validateInput({ text }, ['text']);
      if (!validation.valid) {
        return sendJSON(res, 400, { error: validation.error });
      }

      const systemPrompt = BRIEF_PROMPTS[briefType] || BRIEF_PROMPTS.food;

      if (NODE_ENV === 'development') {
        console.log('Processing brief with model:', requestModelId, 'type:', briefType);
      }

      const result = await callAI({
        prompt: `Обработай следующий текст брифа согласно инструкциям и верни результат СТРОГО в формате JSON:\n\n${text}`,
        systemPrompt,
        modelId: requestModelId,
        briefType,
      });

      // Try to parse JSON from response
      let parsed;
      try {
        // Find JSON in the response (might be wrapped in markdown code blocks)
        // Use greedy match to capture all content, not just until first ```
        const jsonMatch = result.match(/```json\s*([\s\S]*)\s*```/) || result.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : result;
        parsed = JSON.parse(jsonStr);
      } catch {
        parsed = { "Результат": result };
      }

      sendJSON(res, 200, { result: parsed });
    } catch (err) {
      console.error('Error processing brief:', {
        message: err.message,
        stack: err.stack,
        model: requestModelId,
        timestamp: new Date().toISOString()
      });
      sendJSON(res, 500, {
        error: 'Не удалось обработать бриф. Проверьте формат данных.',
        details: err.message,
        model: requestModelId
      });
    }
    return;
  }

  // ===== API: LABEL COMPARISON (image + text) =====
  if (req.method === 'POST' && req.url === '/api/analyze') {
    if (!checkRateLimit(req, res)) return;
    if (!requireApiAuth(req, res)) return;

    let requestModelId = DEFAULT_MODEL;
    try {
      const { imageUrl, text, modelId } = await parseBody(req);
      requestModelId = modelId || DEFAULT_MODEL;

      const validation = validateInput({ imageUrl, text }, ['imageUrl', 'text']);
      if (!validation.valid) {
        return sendJSON(res, 400, { error: validation.error });
      }

      const systemPrompt = COMPARISON_SYSTEM_PROMPT;

      const modelConfig = ALL_MODELS.find(m => m.id === requestModelId);
      if (modelConfig && !modelConfig.capabilities?.images) {
        throw new Error(`Model ${requestModelId} does not support image analysis`);
      }

      if (NODE_ENV === 'development') {
        console.log('Analyzing label with model:', requestModelId);
      }

      const result = await callAI({
        prompt: `ЭТАЛОН (EXCEL):\n${text}\n\nСравни это с изображением. Будь педантичен к регистру букв.`,
        systemPrompt,
        images: [imageUrl],
        modelId: requestModelId
      });

      sendJSON(res, 200, { result });
    } catch (err) {
      console.error('Error analyzing label:', {
        message: err.message,
        stack: err.stack,
        model: requestModelId,
        timestamp: new Date().toISOString()
      });
      sendJSON(res, 500, {
        error: 'Не удалось проанализировать этикетку.',
        details: err.message,
        model: requestModelId
      });
    }
    return;
  }

  // ===== API: FINAL PROOFREAD (image only) =====
  if (req.method === 'POST' && req.url === '/api/proofread') {
    if (!checkRateLimit(req, res)) return;
    if (!requireApiAuth(req, res)) return;

    let requestModelId = DEFAULT_MODEL;
    try {
      const { imageUrl, modelId } = await parseBody(req);
      requestModelId = modelId || DEFAULT_MODEL;

      const validation = validateInput({ imageUrl }, ['imageUrl']);
      if (!validation.valid) {
        return sendJSON(res, 400, { error: validation.error });
      }

      const systemPrompt = FINAL_CHECK_SYSTEM_PROMPT;

      const modelConfig = ALL_MODELS.find(m => m.id === requestModelId);
      if (modelConfig && !modelConfig.capabilities?.images) {
        throw new Error(`Model ${requestModelId} does not support image analysis`);
      }

      if (NODE_ENV === 'development') {
        console.log('Proofreading label with model:', requestModelId);
      }

      const result = await callAI({
        prompt: 'Найди все орфографические и пунктуационные ошибки на изображении.',
        systemPrompt,
        images: [imageUrl],
        modelId: requestModelId
      });

      sendJSON(res, 200, { result });
    } catch (err) {
      console.error('Error proofreading label:', {
        message: err.message,
        stack: err.stack,
        model: requestModelId,
        timestamp: new Date().toISOString()
      });
      sendJSON(res, 500, {
        error: 'Не удалось проверить этикетку.',
        details: err.message,
        model: requestModelId
      });
    }
    return;
  }

  // ===== API: TEXT CHECK (простая проверка текста) =====
  if (req.method === 'POST' && req.url === '/api/check-text') {
    if (!checkRateLimit(req, res)) return;
    if (!requireApiAuth(req, res)) return;

    let requestModelId = DEFAULT_MODEL;
    try {
      const { text, modelId } = await parseBody(req);
      requestModelId = modelId || DEFAULT_MODEL;

      // Валидация
      const validation = validateInput({ text }, ['text']);
      if (!validation.valid) {
        return sendJSON(res, 400, { error: validation.error });
      }

      // Сервер выбирает промпт для проверки текста
      const systemPrompt = TEXT_CHECK_SYSTEM_PROMPT;

      if (NODE_ENV === 'development') {
        console.log('Checking text with model:', requestModelId);
      }

      const result = await callAI({
        prompt: text,
        systemPrompt,
        modelId: requestModelId
      });

      sendJSON(res, 200, { result });
    } catch (err) {
      console.error('Error checking text:', {
        message: err.message,
        stack: err.stack,
        model: requestModelId,
        timestamp: new Date().toISOString()
      });
      sendJSON(res, 500, {
        error: 'Не удалось проверить текст. Попробуйте позже.',
        details: NODE_ENV === 'development' ? err.message : undefined
      });
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

  // ===== API: FABRIKA MACKET QA =====
  if (req.method === 'POST' && req.url === '/api/fabrika/analyze') {
    if (!checkRateLimit(req, res)) return;
    if (!requireApiAuth(req, res)) return;

    let requestModelId = 'gemini-3-flash';
    try {
      const body = await parseBody(req);
      requestModelId = body.modelId || 'gemini-3-flash';

      const v = validateFabrikaInput(body);
      if (!v.valid) return sendJSON(res, 400, { error: v.error });

      const modelConfig = ALL_MODELS.find(m => m.id === requestModelId);
      if (modelConfig && !modelConfig.capabilities?.images) {
        return sendJSON(res, 400, { error: `Модель ${requestModelId} не поддерживает изображения` });
      }

      if (NODE_ENV === 'development') {
        console.log('[Fabrika] main + signs:', 1 + body.signs.length, 'calls, model:', requestModelId);
      }

      const mainTask = callAI({
        prompt: `ТЗ (извлечено из Excel):\n${body.excelText}`,
        systemPrompt: FABRIKA_QA_SYSTEM_PROMPT,
        images: body.pdfPages,
        modelId: requestModelId,
      });

      const signConcurrency = Math.min(3, body.signs.length);
      const signResults = new Array(body.signs.length);
      let nextSignIdx = 0;
      const runNextSign = async () => {
        while (true) {
          const idx = nextSignIdx++;
          if (idx >= body.signs.length) return;
          const sign = body.signs[idx];
          try {
            const raw = await callAI({
              prompt: `Эталонный знак (первое изображение): ${sign.name}. Проверь, присутствует ли он на макете (последующие изображения).`,
              systemPrompt: FABRIKA_SIGN_CHECK_PROMPT,
              images: [sign.dataUrl, ...body.pdfPages],
              modelId: requestModelId,
            });
            signResults[idx] = { name: sign.name, raw, error: false };
          } catch (err) {
            signResults[idx] = { name: sign.name, raw: `ERROR: ${err.message}`, error: true };
          }
        }
      };
      const signWorkers = Array.from({ length: signConcurrency }, runNextSign);

      const [mainMd] = await Promise.all([mainTask, ...signWorkers]);
      const merged = mergeFabrikaReport(mainMd, signResults);

      sendJSON(res, 200, { result: merged, signResults, mainMd });
    } catch (err) {
      console.error('Error in /api/fabrika/analyze:', {
        message: err.message,
        stack: err.stack,
        model: requestModelId,
        timestamp: new Date().toISOString(),
      });
      sendJSON(res, 500, {
        error: 'Не удалось проверить макет Фабрики.',
        details: NODE_ENV === 'development' ? err.message : undefined,
        model: requestModelId,
      });
    }
    return;
  }

  // ===== API: FABRIKA BATCH JOBS =====

  if (req.method === 'POST' && req.url === '/api/fabrika/jobs') {
    if (!checkRateLimit(req, res)) return;
    if (!requireApiAuth(req, res)) return;
    try {
      const { files, fields } = await parseFabrikaMultipart(req);
      if (!files.xlsx || !files.zip) {
        return sendJSON(res, 400, { error: 'xlsx и zip обязательны' });
      }
      let settings = {};
      if (fields.settings) {
        try { settings = JSON.parse(fields.settings); }
        catch { return sendJSON(res, 400, { error: 'settings должно быть валидным JSON' }); }
      }

      const { sheets } = parseBrandSpec(new Uint8Array(files.xlsx));
      const mediaSigns = await extractFabrikaSigns(files.xlsx);
      const zip = await JSZip.loadAsync(files.zip);
      const pdfEntries = Object.values(zip.files).filter((e) => {
        if (e.dir) return false;
        if (!/\.pdf$/i.test(e.name)) return false;
        // macOS Finder zips add __MACOSX/._name.pdf metadata files — skip them
        if (e.name.startsWith('__MACOSX/') || e.name.includes('/__MACOSX/')) return false;
        const base = e.name.split('/').pop() || '';
        if (base.startsWith('._')) return false;
        return true;
      });
      if (pdfEntries.length === 0) return sendJSON(res, 400, { error: 'в ZIP нет PDF' });

      const pdfNames = pdfEntries.map((e) => e.name);
      const { matches, unmatchedColumns } = matchPdfsToColumns(pdfNames, sheets);

      const pdfBuffers = new Map();
      await Promise.all(pdfEntries.map(async (e) => {
        pdfBuffers.set(e.name, await e.async('nodebuffer'));
      }));

      const pdfs = pdfNames.map((name) => {
        const column = matches.get(name) || null;
        return {
          name,
          column,
          specText: column ? buildSpecText(column) : null,
        };
      });

      const job = fabrikaJobStore.create({
        pdfs,
        unmatchedColumns: unmatchedColumns.map((c) => ({ sheet: c.sheet, fileName: c.fileName })),
        settings,
      });
      // stash full columns keyed by rowId so the worker can rebuild prompt text
      job.settings._columns = {};
      job.rows.forEach((row, i) => {
        if (pdfs[i].column) job.settings._columns[row.id] = pdfs[i].column;
      });

      fabrikaJobAssets.set(job.id, { pdfBuffers, signs: mediaSigns });
      runJob(fabrikaJobStore, job.id, pdfBuffers, mediaSigns);

      sendJSON(res, 200, {
        jobId: job.id,
        totalPdfs: job.totalPdfs,
        unmatchedColumns: job.unmatchedColumns,
      });
    } catch (err) {
      console.error('/api/fabrika/jobs error:', err);
      sendJSON(res, 500, {
        error: 'Не удалось создать job',
        details: NODE_ENV === 'development' ? err.message : undefined,
      });
    }
    return;
  }

  {
    const m = req.url && req.url.match(/^\/api\/fabrika\/jobs\/([^/]+)$/);
    if (req.method === 'GET' && m) {
      if (!requireApiAuth(req, res)) return;
      const job = fabrikaJobStore.get(m[1]);
      if (!job) return sendJSON(res, 404, { error: 'job не найден' });
      const { _columns, ...settingsSafe } = job.settings || {};
      const lightRows = job.rows.map(({ mainMd, ...rest }) => rest);
      sendJSON(res, 200, { ...job, rows: lightRows, settings: settingsSafe });
      return;
    }
  }

  {
    const m = req.url && req.url.match(/^\/api\/fabrika\/jobs\/([^/]+)\/stream$/);
    if (req.method === 'GET' && m) {
      if (!requireApiAuth(req, res)) return;
      const job = fabrikaJobStore.get(m[1]);
      if (!job) return sendJSON(res, 404, { error: 'job не найден' });
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      const send = (j) => {
        const lightRows = j.rows.map(({ mainMd, ...rest }) => rest);
        res.write(`data: ${JSON.stringify({ ...j, rows: lightRows, settings: undefined })}\n\n`);
      };
      send(job);
      const unsub = fabrikaJobStore.subscribe(m[1], send);
      req.on('close', () => { unsub(); });
      return;
    }
  }

  {
    const m = req.url && req.url.match(/^\/api\/fabrika\/jobs\/([^/]+)\/rows\/([^/]+)$/);
    if (req.method === 'GET' && m) {
      if (!requireApiAuth(req, res)) return;
      const job = fabrikaJobStore.get(m[1]);
      if (!job) return sendJSON(res, 404, { error: 'job не найден' });
      const row = job.rows.find((r) => r.id === m[2]);
      if (!row) return sendJSON(res, 404, { error: 'row не найден' });
      sendJSON(res, 200, row);
      return;
    }
  }

  {
    const m = req.url && req.url.match(/^\/api\/fabrika\/jobs\/([^/]+)\/rows\/([^/]+)\/retry$/);
    if (req.method === 'POST' && m) {
      if (!requireApiAuth(req, res)) return;
      const assets = fabrikaJobAssets.get(m[1]);
      if (!assets) return sendJSON(res, 404, { error: 'assets для job не найдены (TTL истёк?)' });
      try {
        await retryRow(fabrikaJobStore, m[1], m[2], assets.pdfBuffers, assets.signs);
        sendJSON(res, 200, { ok: true });
      } catch (err) {
        sendJSON(res, 400, { error: err.message });
      }
      return;
    }
  }

  if (req.method === 'GET' && req.url === '/api/fabrika/prompts') {
    if (!requireApiAuth(req, res)) return;
    sendJSON(res, 200, {
      qaSystemPrompt: FABRIKA_QA_SYSTEM_PROMPT,
      signCheckPrompt: FABRIKA_SIGN_CHECK_PROMPT,
    });
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
