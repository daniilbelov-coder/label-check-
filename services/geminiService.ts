import { GoogleGenAI } from "@google/genai";

// HARDCODED OFFICIAL GOOGLE API CREDENTIALS
const DEFAULT_API_KEY = "AIzaSyBHDDg9hjOrMJI4eBaJgBbEaWNS7U68HoE";

const SYSTEM_PROMPT = `
Ты — СТРОГИЙ АЛГОРИТМ КОНТРОЛЯ КАЧЕСТВА (QA). Твоя цель — найти АБСОЛЮТНО ВСЕ различия между исходным текстом и этикеткой. Ты не "креативный корректор", ты "diff-checker".

Входные данные:
1. Таблица Excel (Эталон).
2. Изображение этикетки (Проверяемый объект).

Твоя задача - проверить:
1. Несоответствия текста этикетки и таблицы.
2. Орфографические, грамматические ошибки.
3. Лишние/недостающие символы.

КРИТИЧЕСКИ ВАЖНО: ЧУВСТВИТЕЛЬНОСТЬ К РЕГИСТРУ (CASE SENSITIVITY).
Ты обязан помечать как ошибку любое несовпадение регистра.
Примеры ошибок, которые ты ОБЯЗАН найти:
- В таблице "INCI", на этикетке "Inci" -> ОШИБКА.
- В таблице "мл", на этикетке "Мл" -> ОШИБКА.
- В таблице "Срок Годности", на этикетке "Срок годности" -> ОШИБКА.
Если слово написано с маленькой буквы в таблице, а на этикетке с большой (или наоборот) — это расхождение.

Обязательные блоки для проверки:
1. Наименование продукции
2. Название
3. Состав (INCI) - проверяй каждую букву и запятую.
4. Пищевая/энергетическая ценность (белки, жиры, углеводы)
5. Условия хранения
6. Дата изготовления и срок годности
7. Изготовитель
8. Адрес производства (буква к букве!)
9. Количество (масса нетто/объем)
10. ТУ/ГОСТ

Формат ответа (Markdown):
- Результат дай в виде кратких буллитов.
- Если найдено расхождение в регистре, пиши явно: "Неверный регистр: в таблице 'X', на этикетке 'x'".
- В конце отдельным блоком: "Орфография и пунктуация".
`;

const getClient = () => {
  // Use environment variable if available, otherwise fall back to HARDCODED default
  const envKey = process.env.API_KEY;
  const apiKey = (envKey && envKey.length > 0 && envKey !== 'undefined') ? envKey : DEFAULT_API_KEY;

  if (!apiKey) {
    console.error("API Key missing.");
    throw new Error("API Key is missing. Please check your environment configuration.");
  }

  // Standard initialization for official Google GenAI
  return new GoogleGenAI({ apiKey });
};

export const analyzeLabel = async (
  labelBase64: string,
  labelMimeType: string,
  excelText: string
): Promise<string> => {
  const ai = getClient();

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.0, // Zero temperature for maximum strictness and determinism
      },
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: labelMimeType,
              data: labelBase64,
            },
          },
          {
            text: `ЭТАЛОН (EXCEL):\n${excelText}\n\nСравни это с изображением. Будь педантичен к регистру букв.`,
          },
        ],
      },
    });

    return response.text || "Не удалось получить результат анализа.";
  } catch (error: any) {
    console.error("Gemini API Error (Text Analysis):", error);
    let errorMsg = "Произошла ошибка при анализе текста.";
    
    // Provide more user-friendly error messages for common issues
    if (error.message?.includes("403")) {
        errorMsg += " (Ошибка доступа/API Key неверный).";
    } else if (error.message?.includes("429")) {
        errorMsg += " (Слишком много запросов, попробуйте позже).";
    } else if (error.message) {
        errorMsg += ` (${error.message})`;
    }
    
    throw new Error(errorMsg);
  }
};