import { AVAILABLE_MODELS } from '../config/modelConfig.js';

// Base class for all AI providers
class AIProvider {
  async generateText({ prompt, systemPrompt, images = [] }) {
    throw new Error('generateText() must be implemented by subclass');
  }
}

// Replicate Provider (supports both Community and Official models)
class ReplicateProvider extends AIProvider {
  constructor(apiKey, modelConfig) {
    super();
    this.apiKey = apiKey;
    this.modelConfig = modelConfig;
  }

  async waitForPrediction(predictionId) {
    const maxAttempts = 180; // 6 minutes max
    let lastStatus = '';
    for (let i = 0; i < maxAttempts; i++) {
      const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      });
      const prediction = await response.json();

      // Log status changes
      if (prediction.status !== lastStatus) {
        console.log(`[Replicate] Prediction ${predictionId} status: ${prediction.status}`);
        lastStatus = prediction.status;
      }

      if (prediction.status === 'succeeded') {
        console.log(`[Replicate] Prediction completed. Output type: ${typeof prediction.output}, Is array: ${Array.isArray(prediction.output)}`);
        if (Array.isArray(prediction.output)) {
          console.log(`[Replicate] Array length: ${prediction.output.length}`);
        }
        return prediction.output;
      } else if (prediction.status === 'failed' || prediction.status === 'canceled') {
        console.error(`[Replicate] Prediction failed/canceled:`, prediction.error);
        throw new Error(prediction.error || 'Prediction failed');
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    throw new Error('Prediction timeout');
  }

  buildBriefSchema(briefType) {
    // JSON schema for brief processing (all types use same structure)
    return {
      format: {
        type: 'json_schema',
        name: 'product_brief',
        schema: {
          type: 'object',
          properties: {
            'Наименование продукции': { type: 'string' },
            'Состав': { type: 'string' },
            'Пищевая и энергетическая ценность (калорийность)': { type: 'string' },
            'Условия хранения': { type: 'string' },
            'Дата изготовления и срок годности': { type: 'string' },
            'Исправленный текст': { type: 'string' }
          },
          required: [
            'Наименование продукции',
            'Состав',
            'Пищевая и энергетическая ценность (калорийность)',
            'Условия хранения',
            'Дата изготовления и срок годности',
            'Исправленный текст'
          ],
          additionalProperties: false
        }
      }
    };
  }

  async generateText({ prompt, systemPrompt, images = [], briefType = null }) {
    const { modelType, versionId, modelName, inputSchema, requiresModel, supportsJsonSchema } = this.modelConfig;

    // Build input with dynamic parameters
    const input = {
      prompt,
      temperature: 0.1,
    };

    // Special: GPT-5 Structured requires model parameter
    if (requiresModel && inputSchema.modelKey) {
      input[inputSchema.modelKey] = 'gpt-5-nano';
    }

    // System prompt (key varies by model)
    if (systemPrompt && inputSchema.systemPromptKey) {
      input[inputSchema.systemPromptKey] = systemPrompt;
    }

    // Max tokens (use maximum limit to avoid truncation)
    if (inputSchema.maxTokensKey) {
      // Use maximum allowed by model (65535 for Gemini 3 Flash)
      input[inputSchema.maxTokensKey] = 65535;
    }

    // For Gemini 3 Flash: use low thinking level to save tokens for output
    if (this.modelConfig.id === 'gemini-3-flash') {
      input.thinking_level = 'low';
    }

    // Images
    if (images.length > 0 && inputSchema.imagesKey) {
      input[inputSchema.imagesKey] = images;
    }

    // JSON Schema for structured output (GPT-5 Structured)
    if (supportsJsonSchema && briefType && inputSchema.jsonSchemaKey) {
      input[inputSchema.jsonSchemaKey] = this.buildBriefSchema(briefType);
    }

    // Choose API format based on model type
    const requestBody = modelType === 'community'
      ? { version: versionId, input }  // Community: use version hash
      : { version: modelName, input };  // Official: use model name string

    // Debug: Log the actual request being sent
    console.log('=== REPLICATE REQUEST DEBUG ===');
    console.log('Model:', this.modelConfig.displayName);
    console.log('API Body:', JSON.stringify(requestBody, null, 2));
    console.log('=== END REQUEST DEBUG ===');

    const createResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      let msg = errorText;
      try {
        const ej = JSON.parse(errorText);
        msg = ej.detail || ej.error || errorText;
      } catch (_) {
        /* keep raw */
      }
      throw new Error(
        `Replicate API Error (${this.modelConfig.id}): HTTP ${createResponse.status} - ${msg}`
      );
    }

    const prediction = await createResponse.json();
    const output = await this.waitForPrediction(prediction.id);

    // Debug logging - ALWAYS log for debugging
    console.log('=== REPLICATE OUTPUT DEBUG ===');
    console.log('Model:', this.modelConfig.displayName);
    console.log('Version:', this.modelConfig.versionId || this.modelConfig.modelName);
    console.log('Output type:', typeof output);
    console.log('Is array:', Array.isArray(output));

    if (Array.isArray(output)) {
      console.log('Array length:', output.length);
      output.forEach((item, idx) => {
        console.log(`  [${idx}] type: ${typeof item}, length: ${String(item).length}`);
        console.log(`  [${idx}] first 100 chars:`, String(item).substring(0, 100));
      });
      const joined = output.map(item => String(item)).join('');
      console.log('Total joined length:', joined.length);
      console.log('Joined first 200 chars:', joined.substring(0, 200));
      console.log('Joined last 200 chars:', joined.substring(Math.max(0, joined.length - 200)));
    } else {
      console.log('Output length:', String(output).length);
      console.log('Output sample:', String(output).substring(0, 200));
    }
    console.log('=== END DEBUG ===');

    // Handle structured output from GPT-5
    if (supportsJsonSchema && briefType) {
      // GPT-5 Structured returns { text: "...", json_output: {...} }
      if (output && typeof output === 'object' && output.json_output) {
        return JSON.stringify(output.json_output);
      }
    }

    // Handle different output formats
    if (typeof output === 'string') {
      return output;
    } else if (Array.isArray(output)) {
      // Gemini 3 Flash returns array of strings - join them all
      return output.map(item => String(item)).join('');
    } else if (output && typeof output === 'object') {
      // Some models return objects
      return JSON.stringify(output);
    }

    return String(output);
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

    const modelUri = `gpt://${this.folderId}/${this.modelName}/latest`;

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
      throw new Error('REPLICATE_API_KEY is required for Replicate models');
    }
    return new ReplicateProvider(config.replicateApiKey, model);
  } else if (model.provider === 'yandex') {
    if (!config.yandexApiKey) {
      throw new Error('YANDEX_CLOUD_API_KEY is required for Yandex models');
    }
    if (!config.yandexFolderId) {
      throw new Error('YANDEX_CLOUD_FOLDER is required for Yandex models');
    }
    return new YandexProvider(config.yandexApiKey, config.yandexFolderId, model.model);
  }

  throw new Error(`Unknown provider: ${model.provider}`);
}
