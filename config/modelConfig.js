// AI Model Configuration
// This file defines available AI models and providers

export const ALL_MODELS = [
  // Yandex models (positioned first)
  {
    id: 'yandexgpt',
    model: 'yandexgpt',
    displayName: 'YandexGPT',
    provider: 'yandex',
    description: 'Базовая модель Yandex'
  },
  {
    id: 'yandexgpt-lite',
    model: 'yandexgpt-lite',
    displayName: 'YandexGPT Lite',
    provider: 'yandex',
    description: 'Облегченная модель Yandex'
  },
  // Google Gemini 2.5 Flash (via Replicate)
  {
    id: 'gemini-2.5-flash',
    model: 'gemini-2.5-flash',
    displayName: 'Google Gemini 2.5 Flash',
    provider: 'replicate',
    description: 'Быстрая модель (через Replicate)'
  }
];

export const DEFAULT_MODEL = 'yandexgpt';

// For backend: all models available
export const AVAILABLE_MODELS = ALL_MODELS;
