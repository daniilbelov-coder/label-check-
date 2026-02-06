// === ПРОМПТЫ УДАЛЕНЫ ===
// Все промпты перенесены на backend (services/prompts.js) для защиты коммерческих секретов
// Клиент больше не отправляет промпты на сервер

import type { BriefType } from '../types';

// Получаем API ключ из localStorage (после входа) или из .env (для разработки)
function getApiSecret(): string {
  // Сначала проверяем localStorage (для production после входа)
  const storedSecret = localStorage.getItem('api_secret');
  if (storedSecret) return storedSecret;

  // Fallback для локальной разработки
  return import.meta.env.VITE_API_SECRET || '';
}

// Вспомогательная функция для fetch с аутентификацией
const fetchWithAuth = (url: string, options: RequestInit = {}) => {
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'X-API-Key': getApiSecret(),
    },
  });
};

// --- SERVICE 1: BRIEF PROCESSING ---
export const processBrief = async (
  excelText: string,
  briefType: BriefType,
  modelId?: string
): Promise<Record<string, string>> => {
  const response = await fetchWithAuth('/api/brief', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: excelText,
      briefType,
      modelId: modelId || 'gemini-2.5-flash'
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.result || { "Ошибка": "Пустой ответ от API" };
};

// --- SERVICE 2: LABEL COMPARISON ---
export const analyzeLabel = async (
  labelBase64: string,
  labelMimeType: string,
  excelText: string,
  modelId?: string
): Promise<string> => {
  const imageUrl = `data:${labelMimeType};base64,${labelBase64}`;

  const response = await fetchWithAuth('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageUrl,
      text: excelText,
      modelId,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.result || 'Пустой ответ от API';
};

// --- SERVICE 3: FINAL CHECK ---
export const proofreadLabel = async (
  labelBase64: string,
  labelMimeType: string,
  modelId?: string
): Promise<string> => {
  const imageUrl = `data:${labelMimeType};base64,${labelBase64}`;

  const response = await fetchWithAuth('/api/proofread', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageUrl,
      modelId,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.result || 'Пустой ответ от API';
};

// --- SERVICE 4: TEXT CHECK ---
/**
 * Проверка текста (без изображений и Excel)
 */
export const checkText = async (text: string, modelId?: string): Promise<string> => {
  const apiSecret = localStorage.getItem('api_secret');

  if (!apiSecret) {
    throw new Error('API secret не найден. Пожалуйста, авторизуйтесь снова.');
  }

  const response = await fetch('/api/check-text', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiSecret
    },
    body: JSON.stringify({
      text,
      modelId: modelId || undefined
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `API Error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.result;
};

// --- SERVICE 4: GET AVAILABLE MODELS ---
export const getAvailableModels = async (filter?: 'images' | 'text') => {
  const params = filter ? `?filter=${filter}` : '';
  const response = await fetchWithAuth(`/api/available-models${params}`);

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data;
};

// --- SERVICE 5: GET PROMPTS ---
export const getPrompts = async (): Promise<Record<string, string>> => {
  const response = await fetchWithAuth('/api/prompts', {
    method: 'GET'
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.prompts;
};

// --- SERVICE 6: SAVE PROMPTS ---
export const savePrompts = async (prompts: Record<string, string>): Promise<{ success: boolean; message: string }> => {
  const response = await fetchWithAuth('/api/prompts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompts })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data;
};
