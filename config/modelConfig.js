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
  // Google Gemini 2.5 Flash (via Replicate) - Community Model
  {
    id: 'gemini-2.5-flash',
    model: 'gemini-2.5-flash',
    displayName: 'Google Gemini 2.5 Flash',
    provider: 'replicate',
    modelType: 'community',
    versionId: 'bfb7df9586ae4fafa00a593d8dc4868698f72cf9d695da28b8c8a70f88e876ba',
    inputSchema: {
      systemPromptKey: 'system_instruction',
      maxTokensKey: 'max_output_tokens',
      imagesKey: 'images'
    },
    description: 'Быстрая модель (через Replicate)'
  },
  // Google Gemini 3 Flash (via Replicate) - Community Model
  {
    id: 'gemini-3-flash',
    model: 'gemini-3-flash',
    displayName: 'Google Gemini 3 Flash',
    provider: 'replicate',
    modelType: 'community',
    versionId: '12917939800a325e127c528db67c32fe8a23a51c0400690e68c8731c2508c553',
    inputSchema: {
      systemPromptKey: 'system_instruction',
      maxTokensKey: 'max_output_tokens',
      imagesKey: 'images'
    },
    description: 'Самая быстрая модель Google с передовым интеллектом'
  },
  // OpenAI GPT-5 Structured (via Replicate) - Official Model
  {
    id: 'gpt-5-structured',
    model: 'gpt-5-structured',
    displayName: 'OpenAI GPT-5 Structured',
    provider: 'replicate',
    modelType: 'official',
    modelName: 'openai/gpt-5-structured',
    inputSchema: {
      modelKey: 'model',
      systemPromptKey: 'instructions',
      maxTokensKey: 'max_output_tokens',
      imagesKey: 'image_input',
      jsonSchemaKey: 'json_schema'
    },
    requiresModel: true,
    supportsJsonSchema: true,
    description: 'GPT-5 с поддержкой structured output'
  }
];

export const DEFAULT_MODEL = 'yandexgpt';

// For backend: all models available
export const AVAILABLE_MODELS = ALL_MODELS;
