import { createAIProvider } from './aiProviders.js';
import { DEFAULT_MODEL } from '../config/modelConfig.js';

const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY;
const YANDEX_API_KEY = process.env.YANDEX_CLOUD_API_KEY;
const YANDEX_FOLDER_ID = process.env.YANDEX_CLOUD_FOLDER;

export async function callAI({
  prompt,
  systemPrompt,
  images = [],
  modelId = DEFAULT_MODEL,
  briefType = null,
}) {
  const provider = createAIProvider(modelId, {
    replicateApiKey: REPLICATE_API_KEY,
    yandexApiKey: YANDEX_API_KEY,
    yandexFolderId: YANDEX_FOLDER_ID,
  });
  return provider.generateText({ prompt, systemPrompt, images, briefType });
}
