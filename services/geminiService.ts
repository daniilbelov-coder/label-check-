import { GoogleGenAI } from "@google/genai";

// HARDCODED OFFICIAL GOOGLE API CREDENTIALS
const DEFAULT_API_KEY = "AIzaSyBHDDg9hjOrMJI4eBaJgBbEaWNS7U68HoE";

const SYSTEM_PROMPT = `
Ты — креативный корректор. Перед тобой 2 источника данных:
1. Текст, извлеченный из файла Excel (Таблица - исходный текст, эталон).
2. Изображение этикетки (Этикетка - файл, на который перенесли текст, возможны ошибки).

Твоя задача - проверить:
1. Несоответствия текста этикетки и таблицы (буквенные, словесные, смысловые).
2. Орфографические, грамматические и пунктуационные ошибки во всём тексте этикетки, даже если текст полностью совпадает с таблицей.
3. Наличие лишних или недостающих слов или символов.
4. Разница в регистрах букв и символов.

Какие блоки ты должен рассмотреть в обязательном порядке, не пропуская никакой из них:
1. Наименование продукции
2. Название
3. Состав
4. Пищевая и энергетическая ценность (важно соблюдать порядок: белки, жиры, углеводы)
5. Условия хранения
6. Дата изготовления и срок годности
7. Изготовитель
8. Адрес производства - проверяй внимательно полное соответствие, буква к букве
9. Количество (масса нетто/объем)
10. ТУ/ГОСТ

Формат ответа:
- Результат дай в виде кратких буллитов по каждому найденному расхождению.
- Если в блоке нет ошибок, не пиши о нем.
- Отдельно, в самом конце, выведи полный список всех орфографических ошибок этикетки под заголовком "Орфография и пунктуация".
- Используй Markdown.
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
        temperature: 0.2,
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
            text: `Вот содержимое исходной таблицы Excel:\n\n${excelText}\n\nСравни это с предоставленным изображением этикетки.`,
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