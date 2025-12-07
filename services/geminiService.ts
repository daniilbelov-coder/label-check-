import { GoogleGenAI } from "@google/genai";

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
  // Access environment variables injected by Vite
  // @ts-ignore
  const apiKey = process.env.API_KEY;
  // @ts-ignore
  const baseUrlEnv = process.env.BASE_URL;

  if (!apiKey) {
    console.error("API Key missing in environment.");
    throw new Error("API Key is missing. Please check your Railway variables.");
  }

  const config: any = { apiKey: apiKey };

  // Handle Custom Base URL (e.g., Artemox)
  if (baseUrlEnv) {
    // Remove trailing slashes
    let cleanUrl = baseUrlEnv.replace(/\/$/, ""); 
    
    // If the URL ends with /v1, strip it because the SDK appends paths automatically.
    // However, if the provider is strict about the base path, we adjust here.
    // Standard Google GenAI SDK usage with custom base URL usually requires the root domain.
    if (cleanUrl.endsWith("/v1")) {
       cleanUrl = cleanUrl.substring(0, cleanUrl.length - 3);
    }
    
    config.baseUrl = cleanUrl;
  }
  
  // Custom headers for 'sk-' keys (OpenAI-compatible proxies often need Bearer auth)
  if (apiKey.startsWith('sk-')) {
    config.customHeaders = {
      'Authorization': `Bearer ${apiKey}`
    };
  }

  return new GoogleGenAI(config);
};

export const analyzeLabel = async (
  labelBase64: string,
  labelMimeType: string,
  excelText: string
): Promise<string> => {
  const ai = getClient();

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-lite', // Specific model for your provider
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
    if (error.message) errorMsg += ` (${error.message})`;
    throw new Error(errorMsg);
  }
};

export const generateAnnotatedLabel = async (
  labelBase64: string,
  labelMimeType: string,
  analysisReport: string
): Promise<string | undefined> => {
  const ai = getClient();

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image', // Using the image model
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: labelMimeType,
              data: labelBase64,
            },
          },
          {
            text: `Это изображение этикетки продукта. 
            Были найдены следующие ошибки:
            ${analysisReport.substring(0, 500)}...
            
            Верни это же изображение, но НАРИСУЙ на нем красные обводки/стрелки в местах ошибок.`,
          },
        ],
      },
    });

    // Extract the image from response
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
         if (part.inlineData && part.inlineData.data) {
             return part.inlineData.data;
         }
      }
    }
    return undefined;
  } catch (error) {
    console.error("Gemini API Error (Image Annotation):", error);
    // Silent fail for annotation is acceptable, just return undefined
    return undefined;
  }
};