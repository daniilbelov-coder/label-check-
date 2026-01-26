// AI Model Configuration
// This file defines available AI models and providers

export const ALL_MODELS = [
  {
    id: 'gemini-2.5-flash',
    name: 'gemini-2.5-flash',
    displayName: 'Google Gemini 2.5 Flash',
    provider: 'replicate',
    description: 'Быстрая модель (через Replicate)'
  },
  {
    id: 'yandexgpt',
    name: 'yandexgpt',
    displayName: 'YandexGPT (Alice AI)',
    provider: 'yandex',
    description: 'Базовая модель Yandex'
  },
  {
    id: 'yandexgpt-pro',
    name: 'yandexgpt-pro',
    displayName: 'YandexGPT Pro',
    provider: 'yandex',
    description: 'Продвинутая модель Yandex'
  }
];

export const DEFAULT_MODEL = 'gemini-2.5-flash';

// For backend: all models available
export const AVAILABLE_MODELS = ALL_MODELS;
