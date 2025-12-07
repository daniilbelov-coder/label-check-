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
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing in environment variables.");
  }
  const config: any = { apiKey: process.env.API_KEY };
  if (process.env.BASE_URL) {
    config.baseUrl = process.env.BASE_URL;
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
  } catch (error) {
    console.error("Gemini API Error (Text Analysis):", error);
    throw new Error("Произошла ошибка при анализе текста. Проверьте файлы и ключ API.");
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
      model: 'gemini-2.5-flash-image', // Using the image generation/edit model
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
            Были найдены следующие ошибки (см. ниже).
            Пожалуйста, верни это же изображение, но НАРИСУЙ на нем красные линии/круги/стрелки, указывающие на места этих ошибок. Сделай это в стиле инфографики.
            
            Список ошибок для визуализации:
            ${analysisReport.substring(0, 1000)}... (сокращено)
            `,
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
    // Warning only, don't fail the whole process if annotation fails
    return undefined;
  }
};