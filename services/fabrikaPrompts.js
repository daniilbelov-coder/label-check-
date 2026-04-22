import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const QA_PROMPT_PATH = path.join(__dirname, '..', 'qa_prompt.md');

let cachedQaPrompt = null;

function loadQaPrompt() {
  if (cachedQaPrompt !== null) return cachedQaPrompt;
  try {
    cachedQaPrompt = fs.readFileSync(QA_PROMPT_PATH, 'utf-8');
  } catch (err) {
    console.error('Failed to load qa_prompt.md:', err.message);
    cachedQaPrompt = '';
  }
  return cachedQaPrompt;
}

export const FABRIKA_QA_SYSTEM_PROMPT = loadQaPrompt();

export const FABRIKA_SIGN_CHECK_PROMPT = `
Ты — детектор пиктограмм на упаковке.

Вход:
1. Первое изображение — эталонный знак (из ТЗ).
2. Последующие изображения — страницы макета (PDF, отрендеренный в PNG).

Задача: определить, присутствует ли этот знак на макете.
Критерии совпадения:
- Совпадает силуэт/форма/символика.
- Цвет и точный размер — вторичны.
- Отличай от других пиктограмм и декоративных элементов.

Ответ СТРОГО в формате JSON, без пояснений, без вступлений:
{
  "found": true | false,
  "confidence": "high" | "medium" | "low",
  "location": "коротко где найден (стр. N, сторона, рядом с чем)" | null,
  "notes": "если сомневаешься — что смутило" | null
}
`;

export function reloadFabrikaPrompts() {
  cachedQaPrompt = null;
  return loadQaPrompt();
}
