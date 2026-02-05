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
  // OpenAI GPT-5 Nano Structured (via Replicate) - guaranteed clean JSON
  {
    id: 'gpt-5-nano',
    model: 'openai/gpt-5-structured',
    displayName: 'OpenAI GPT-5 Nano',
    provider: 'replicate',
    description: 'Быстрая GPT-5 с гарантированным JSON',
    capabilities: { images: true, systemPrompt: true },
    inputMapping: {
      model: 'model',  // For gpt-5-structured, we need to specify which model
      systemPrompt: 'system_prompt',
      images: 'image_input',
      maxTokens: 'max_tokens'
    }
  }
];

export const DEFAULT_MODEL = 'yandexgpt';

// For backend: all models available
export const AVAILABLE_MODELS = ALL_MODELS;
