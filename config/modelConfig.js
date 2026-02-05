// AI Model Configuration
// This file defines available AI models and providers

export const ALL_MODELS = [
  // Yandex models (positioned first) - WORKING
  {
    id: 'yandexgpt',
    model: 'yandexgpt',
    displayName: 'YandexGPT',
    provider: 'yandex',
    description: 'Базовая модель Yandex',
    capabilities: { images: false, systemPrompt: true },
    inputMapping: {}
  },
  {
    id: 'yandexgpt-lite',
    model: 'yandexgpt-lite',
    displayName: 'YandexGPT Lite',
    provider: 'yandex',
    description: 'Облегченная модель Yandex',
    capabilities: { images: false, systemPrompt: true },
    inputMapping: {}
  },
  // OpenAI GPT-5 Nano (via Replicate)
  {
    id: 'gpt-5-nano',
    model: 'openai/gpt-5-nano',
    displayName: 'OpenAI GPT-5 Nano',
    provider: 'replicate',
    description: 'Быстрая GPT-5',
    capabilities: { images: true, systemPrompt: true },
    inputMapping: {
      systemPrompt: 'system_prompt',
      images: 'image_input',
      maxTokens: 'max_completion_tokens'
    }
  }
];

export const DEFAULT_MODEL = 'yandexgpt';

// For backend: all models available
export const AVAILABLE_MODELS = ALL_MODELS;
