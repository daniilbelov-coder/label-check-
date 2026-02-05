import { AVAILABLE_MODELS } from '../config/modelConfig.js';

// Base class for all AI providers
class AIProvider {
  async generateText({ prompt, systemPrompt, images = [] }) {
    throw new Error('generateText() must be implemented by subclass');
  }
}

// Replicate Provider (supports multiple models via Replicate API)
class ReplicateProvider extends AIProvider {
  constructor(apiKey, modelConfig) {
    super();
    this.apiKey = apiKey;
    this.modelConfig = modelConfig;
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
    const { model, inputMapping, capabilities } = this.modelConfig;
    
    // Build input with dynamic mapping
    const input = {
      prompt,
      temperature: 0.1,
    };

    // Handle system prompt
    if (systemPrompt) {
      if (capabilities.systemPrompt && inputMapping.systemPrompt) {
        // Model supports system prompt natively
        input[inputMapping.systemPrompt] = systemPrompt;
      } else {
        // Model doesn't support system prompt - prepend to user prompt
        input.prompt = `${systemPrompt}\n\n---\n\n${prompt}`;
      }
    }

    // Handle images
    if (images.length > 0) {
      if (capabilities.images && inputMapping.images) {
        input[inputMapping.images] = images;
      } else {
        throw new Error(`Model ${model} does not support image inputs`);
      }
    }

    // Set max tokens with model-specific key
    if (inputMapping.maxTokens) {
      input[inputMapping.maxTokens] = 8192;
    }

    // Use model identifier endpoint (owner/model-name)
    const apiUrl = `https://api.replicate.com/v1/models/${model}/predictions`;
    
    const createResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait',
      },
      body: JSON.stringify({ input }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      let errorMessage = errorText;

      // Try to parse JSON error response from Replicate
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.detail || errorJson.error || errorText;
      } catch (e) {
        // If not JSON, use raw text
      }

      throw new Error(
        `Replicate API Error (${model}): HTTP ${createResponse.status} - ${errorMessage}`
      );
    }

    const prediction = await createResponse.json();

    console.log('📊 Replicate prediction status:', prediction.status);

    // If prediction is still processing, poll for result
    let output;
    if (prediction.status === 'succeeded') {
      output = prediction.output;
    } else if (prediction.status === 'processing' || prediction.status === 'starting') {
      output = await this.waitForPrediction(prediction.id);
    } else if (prediction.status === 'failed') {
      throw new Error(prediction.error || 'Prediction failed');
    } else {
      output = await this.waitForPrediction(prediction.id);
    }

    console.log('📊 Output type:', typeof output, 'is array:', Array.isArray(output));

    if (Array.isArray(output)) {
      console.log('📊 Array length:', output.length, 'elements');
      console.log('📊 Array elements:');
      output.forEach((item, i) => {
        console.log(`   [${i}]: "${item.substring(0, 60)}${item.length > 60 ? '...' : ''}"`);
      });
    } else {
      console.log('📊 Raw output:', output?.substring?.(0, 200));
    }

    const finalResult = typeof output === 'string' ? output : (Array.isArray(output) ? output.join('') : JSON.stringify(output));
    console.log('📊 Final result length:', finalResult.length, 'chars');
    console.log('📊 Final result starts with:', finalResult.substring(0, 100));
    console.log('📊 Final result ends with:', finalResult.substring(finalResult.length - 100));

    return finalResult;
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
  const modelConfig = AVAILABLE_MODELS.find(m => m.id === modelId);

  if (!modelConfig) {
    throw new Error(`Unknown model: ${modelId}`);
  }

  if (modelConfig.provider === 'replicate') {
    if (!config.replicateApiKey) {
      throw new Error('REPLICATE_API_KEY is required for Replicate models');
    }
    return new ReplicateProvider(config.replicateApiKey, modelConfig);
  } else if (modelConfig.provider === 'yandex') {
    if (!config.yandexApiKey) {
      throw new Error('YANDEX_CLOUD_API_KEY is required for Yandex models');
    }
    if (!config.yandexFolderId) {
      throw new Error('YANDEX_CLOUD_FOLDER is required for Yandex models');
    }
    return new YandexProvider(config.yandexApiKey, config.yandexFolderId, modelConfig.model);
  }

  throw new Error(`Unknown provider: ${modelConfig.provider}`);
}
