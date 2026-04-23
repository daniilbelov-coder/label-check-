import { callAI } from './callAI.js';
import { FABRIKA_QA_SYSTEM_PROMPT, FABRIKA_SIGN_CHECK_PROMPT } from './fabrikaPrompts.js';
import { fabrikaMergeReport } from '../utils/fabrikaMergeReport.js';
import { rasterizePdfBuffer } from './pdfRasterizer.js';
import { buildSpecText } from './xlsxSpecParser.js';

// Signs fire in small parallel batches; 429s are retried in aiProviders.js.
const SIGN_CONCURRENCY = Number(process.env.FABRIKA_SIGN_CONCURRENCY) || 3;
const MAIN_QA_MAX_PAGES = Number(process.env.FABRIKA_QA_MAX_PAGES) || 6;
const SIGN_CHECK_MAX_PAGES = Number(process.env.FABRIKA_SIGN_MAX_PAGES) || 3;

/**
 * Run the full per-PDF QA: rasterize, main QA call, parallel sign checks, merge.
 *
 * @param {object} args
 * @param {Uint8Array | Buffer} args.pdfBuffer
 * @param {object} args.column       result of matchPdfsToColumns for this PDF
 * @param {Array<{name: string, dataUrl: string}>} args.signs
 * @param {{ modelId?: string, qaSystemPrompt?: string, signCheckPrompt?: string }} args.settings
 * @returns {Promise<{ mainMd: string, signResults: any[], merged: string, specText: string }>}
 */
export async function analyzePdfRow({ pdfBuffer, column, signs, settings = {} }) {
  if (!column) throw new Error('no matching spec column');
  const systemPrompt = settings.qaSystemPrompt?.trim() || FABRIKA_QA_SYSTEM_PROMPT;
  const signPrompt = settings.signCheckPrompt?.trim() || FABRIKA_SIGN_CHECK_PROMPT;
  const modelId = settings.modelId || 'gemini-3-flash';

  const pdfPages = await rasterizePdfBuffer(pdfBuffer, {
    dpi: 150,
    maxPages: Math.max(MAIN_QA_MAX_PAGES, SIGN_CHECK_MAX_PAGES),
  });
  const qaPages = pdfPages.slice(0, MAIN_QA_MAX_PAGES);
  const signPages = pdfPages.slice(0, SIGN_CHECK_MAX_PAGES);
  const specText = buildSpecText(column);

  const mainTask = callAI({
    prompt: `Проверяемая модель: ${column.fileName}\nКатегория: ${column.sheet}\n\nЭталонная спека:\n${specText}\n\nПроверь PDF-макет по 11 категориям.`,
    systemPrompt,
    images: qaPages,
    modelId,
  });

  const signResults = new Array(signs.length);
  let nextIdx = 0;
  const workerCount = Math.min(SIGN_CONCURRENCY, signs.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const idx = nextIdx++;
      if (idx >= signs.length) return;
      const sign = signs[idx];
      try {
        const raw = await callAI({
          prompt: `Эталонный знак (первое изображение): ${sign.name}. Проверь, присутствует ли он на макете (последующие изображения).`,
          systemPrompt: signPrompt,
          images: [sign.dataUrl, ...signPages],
          modelId,
        });
        signResults[idx] = { name: sign.name, raw, error: null };
      } catch (err) {
        signResults[idx] = { name: sign.name, raw: '', error: err.message };
      }
    }
  });

  const [mainMd] = await Promise.all([mainTask, ...workers]);
  const merged = fabrikaMergeReport(mainMd, signResults);
  return { mainMd, signResults, merged, specText };
}
