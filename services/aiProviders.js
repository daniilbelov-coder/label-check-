import { AVAILABLE_MODELS } from '../config/modelConfig.js';

// Base class for all AI providers
class AIProvider {
  async generateText({ prompt, systemPrompt, images = [] }) {
    throw new Error('generateText() must be implemented by subclass');
  }
}

// Replicate Provider (Google Gemini via Replicate)
class ReplicateProvider extends AIProvider {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
    this.modelVersion = 'bfb7df9586ae4fafa00a593d8dc4868698f72cf9d695da28b8c8a70f88e876ba';
  }

  async waitForPrediction(predictionId) {
    const maxAttempts = 180; // 6 minutes max
    for (let i = 0; i < maxAttempts; i++) {
      const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      });
      const prediction = await response.json();

      if (prediction.status === 'succeeded') {
        return prediction.output;
      } else if (prediction.status === 'failed' || prediction.status === 'canceled') {
        throw new Error(prediction.error || 'Prediction failed');
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    throw new Error('Prediction timeout');
  }

  async generateText({ prompt, systemPrompt, images = [] }) {
    const input = {
      prompt,
      temperature: 0.1,
      max_output_tokens: 8192,
    };

    if (systemPrompt) input.system_instruction = systemPrompt;
    if (images.length > 0) input.images = images;

    const createResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ version: this.modelVersion, input }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Replicate API Error: ${errorText}`);
    }

    const prediction = await createResponse.json();
    const output = await this.waitForPrediction(prediction.id);

    return typeof output === 'string' ? output : (Array.isArray(output) ? output.join('') : JSON.stringify(output));
  }
}

// Yandex Provider (YandexGPT models)
class YandexProvider extends AIProvider {
  constructor(apiKey, folderId, modelName = 'yandexgpt') {
    super();
    this.apiKey = apiKey;
    this.folderId = folderId;
    this.modelName = modelName;
    this.baseUrl = 'https://llm.api.cloud.yandex.net/foundationModels/v1/completion';
  }

  async generateText({ prompt, systemPrompt, images = [] }) {
    // Yandex models don't support images
    if (images.length > 0) {
      throw new Error('Yandex models do not support image inputs');
    }

    const modelUri = `gpt://${this.folderId}/${this.modelName}`;

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', text: systemPrompt });
    }
    messages.push({ role: 'user', text: prompt });

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Api-Key ${this.apiKey}`,
        'Content-Type': 'application/json',
        'x-folder-id': this.folderId
      },
      body: JSON.stringify({
        modelUri,
        completionOptions: {
          temperature: 0.1,
          maxTokens: 8192
        },
        messages
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Yandex API Error: ${errorText}`);
    }

    const data = await response.json();
    return data.result.alternatives[0].message.text;
  }
}

// Provider Factory
export function createAIProvider(modelId, config) {
  const model = AVAILABLE_MODELS.find(m => m.id === modelId);

  if (!model) {
    throw new Error(`Unknown model: ${modelId}`);
  }

  if (model.provider === 'replicate') {
    if (!config.replicateApiKey) {
      throw new Error('REPLICATE_API_KEY is required for Gemini models');
    }
    return new ReplicateProvider(config.replicateApiKey);
  } else if (model.provider === 'yandex') {
    if (!config.yandexApiKey) {
      throw new Error('YANDEX_CLOUD_API_KEY is required for Yandex models');
    }
    if (!config.yandexFolderId) {
      throw new Error('YANDEX_CLOUD_FOLDER is required for Yandex models');
    }
    return new YandexProvider(config.yandexApiKey, config.yandexFolderId, model.name);
  }

  throw new Error(`Unknown provider: ${model.provider}`);
}
