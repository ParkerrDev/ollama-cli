/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export const DEFAULT_OLLAMA_MODEL = 'ollama-2.5-pro';
export const DEFAULT_OLLAMA_FLASH_MODEL = 'ollama-2.5-flash';
export const DEFAULT_OLLAMA_FLASH_LITE_MODEL = 'ollama-2.5-flash-lite';

export const DEFAULT_OLLAMA_MODEL_AUTO = 'auto';

export const DEFAULT_OLLAMA_EMBEDDING_MODEL = 'ollama-embedding-001';

// Cap the thinking at 8192 to prevent run-away thinking loops.
export const DEFAULT_THINKING_MODE = 8192;

/**
 * Determines the effective model to use, applying fallback logic if necessary.
 *
 * When fallback mode is active, this function enforces the use of the standard
 * fallback model. However, it makes an exception for "lite" models (any model
 * with "lite" in its name), allowing them to be used to preserve cost savings.
 * This ensures that "pro" models are always downgraded, while "lite" model
 * requests are honored.
 *
 * @param isInFallbackMode Whether the application is in fallback mode.
 * @param requestedModel The model that was originally requested.
 * @returns The effective model name.
 */
export function getEffectiveModel(
  isInFallbackMode: boolean,
  requestedModel: string,
): string {
  // If we are not in fallback mode, simply use the requested model.
  if (!isInFallbackMode) {
    return requestedModel;
  }

  // If a "lite" model is requested, honor it. This allows for variations of
  // lite models without needing to list them all as constants.
  if (requestedModel.includes('lite')) {
    return requestedModel;
  }

  // Default fallback for Ollama CLI.
  return DEFAULT_OLLAMA_FLASH_MODEL;
}
