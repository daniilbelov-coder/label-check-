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

export const analyzeLabel = async (
  labelBase64: string,
  labelMimeType: string,
  excelText: string
): Promise<string> => {
  try {
    // Build OpenAI-compatible message format with image
    const messages = [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${labelMimeType};base64,${labelBase64}`,
            },
          },
          {
            type: 'text',
            text: `ЭТАЛОН (EXCEL):\n${excelText}\n\nСравни это с изображением. Будь педантичен к регистру букв.`,
          },
        ],
      },
    ];

    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.details || `HTTP ${response.status}`);
    }

    const data = await response.json();
    
    // Extract text from OpenAI-compatible response format
    const resultText = data.choices?.[0]?.message?.content;
    
    if (!resultText) {
      throw new Error('Empty response from API');
    }

    return resultText;
  } catch (error: any) {
    console.error("API Error (Text Analysis):", error);
    let errorMsg = "Произошла ошибка при анализе текста.";
    
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
