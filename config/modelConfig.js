// AI Model Configuration
// This file defines available AI models and providers

export const ALL_MODELS = [
  // Yandex models (positioned first)
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
  // Google Gemini models (via Replicate)
  {
    id: 'gemini-3-flash',
    model: 'google/gemini-3-flash',
    displayName: 'Google Gemini 3 Flash',
    provider: 'replicate',
    description: 'Быстрая Gemini 3',
    capabilities: { images: true, systemPrompt: true },
    inputMapping: {
      systemPrompt: 'system_instruction',
      images: 'images',
      maxTokens: 'max_output_tokens'
    }
  },
  {
    id: 'gemini-2.5-flash',
    model: 'google/gemini-2.5-flash',
    displayName: 'Google Gemini 2.5 Flash',
    provider: 'replicate',
    description: 'быстрая модель',
    capabilities: { images: true, systemPrompt: true },
    inputMapping: {
      systemPrompt: 'system_instruction',
      images: 'images',
      maxTokens: 'max_output_tokens'
    }
  },
  {
    id: 'gemini-3-pro',
    model: 'google/gemini-3-pro',
    displayName: 'Google Gemini 3 Pro',
    provider: 'replicate',
    description: 'Продвинутая модель с reasoning',
    capabilities: { images: true, systemPrompt: true },
    inputMapping: {
      systemPrompt: 'system_instruction',
      images: 'images',
      maxTokens: 'max_output_tokens'
    }
  },
  // OpenAI GPT-5 (via Replicate)
  {
    id: 'gpt-5-nano',
    model: 'openai/gpt-5-nano',
    displayName: 'OpenAI GPT-5 Nano',
    provider: 'replicate',
    description: 'Быстрая и экономичная GPT-5',
    capabilities: { images: true, systemPrompt: true },
    inputMapping: {
      systemPrompt: 'system_prompt',
      images: 'image_input',
      maxTokens: 'max_completion_tokens'
    }
  },
  // xAI Grok (via Replicate) - text only
  {
    id: 'grok-4',
    model: 'xai/grok-4',
    displayName: 'xAI Grok 4',
    provider: 'replicate',
    description: 'Только текст, без изображений',
    capabilities: { images: false, systemPrompt: false },
    inputMapping: {
      maxTokens: 'max_tokens'
    }
  }
];

export const DEFAULT_MODEL = 'yandexgpt';

// For backend: all models available
export const AVAILABLE_MODELS = ALL_MODELS;
