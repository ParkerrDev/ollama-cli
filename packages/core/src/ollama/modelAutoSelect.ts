/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OllamaModelClient, type OllamaModel } from './client.js';
import { debugLogger } from '../utils/debugLogger.js';

/**
 * Test if a model is healthy by sending a minimal request
 */
async function testModelHealth(
  modelName: string,
  baseUrl: string,
): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: 'test' }],
        stream: false,
        options: {
          num_predict: 1, // Only generate 1 token for health check
        },
      }),
      signal: AbortSignal.timeout(5000), // 5 second timeout for health check
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    // Check for error in response
    if ('error' in data) {
      debugLogger.debug(
        `Model ${modelName} health check failed: ${data.error}`,
      );
      return false;
    }

    return true;
  } catch (error) {
    debugLogger.debug(`Model ${modelName} health check failed: ${error}`);
    return false;
  }
}

/**
 * Select the smallest healthy model from Ollama for internal operations like classification
 */
export async function selectSmallestOllamaModel(
  baseUrl: string = 'http://localhost:11434',
): Promise<string | null> {
  try {
    const client = new OllamaModelClient(baseUrl, 5000); // 5 second timeout
    const models = await client.listModels();

    if (models.length === 0) {
      return null;
    }

    // Sort by size (smallest first)
    const sortedModels = [...models].sort((a, b) => a.size - b.size);

    // Try models in order of size until we find a healthy one
    for (const model of sortedModels) {
      debugLogger.debug(`Testing model health: ${model.name}...`);
      const isHealthy = await testModelHealth(model.name, baseUrl);

      if (isHealthy) {
        debugLogger.debug(
          `Auto-selected smallest healthy model: ${model.name} (${(model.size / 1024 / 1024 / 1024).toFixed(2)} GB)`,
        );
        return model.name;
      } else {
        debugLogger.debug(`Model ${model.name} is not healthy, trying next...`);
      }
    }

    // If no healthy models found, return the smallest anyway as fallback
    debugLogger.warn('No healthy models found, using smallest model anyway');
    return sortedModels[0].name;
  } catch (error) {
    debugLogger.warn(`Failed to auto-select model from Ollama: ${error}`);
    return null;
  }
}

/**
 * Format model list for error messages
 */
export function formatModelList(models: OllamaModel[]): string {
  if (models.length === 0) {
    return 'No models found.';
  }

  return models
    .map(
      (m) => `  - ${m.name} (${(m.size / 1024 / 1024 / 1024).toFixed(2)} GB)`,
    )
    .join('\n');
}
