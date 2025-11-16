/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Default Ollama models - users should specify their own models via --model flag
// These are just fallback defaults
export const DEFAULT_OLLAMA_MODEL = 'llama3.2';
export const DEFAULT_OLLAMA_FLASH_MODEL = 'llama3.2';
export const DEFAULT_OLLAMA_FLASH_LITE_MODEL = 'llama3.2';

// For compatibility - "auto" now just uses the default model
export const DEFAULT_OLLAMA_MODEL_AUTO = DEFAULT_OLLAMA_MODEL;

export const DEFAULT_OLLAMA_EMBEDDING_MODEL = 'nomic-embed-text';

// Cap the thinking at 8192 to prevent run-away thinking loops.
export const DEFAULT_THINKING_MODE = 8192;

/**
 * Determines the effective model to use, applying fallback logic if necessary.
 *
 * When fallback mode is active, this function enforces the use of the standard
 * fallback model. However, it makes an exception for "lite" models (any model
 * with "lite" or "1b" in its name), allowing them to be used to preserve cost savings.
 * This ensures that larger models are always downgraded, while lite model
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

  // If a "lite" or small model is requested, honor it. This allows for variations of
  // lite models without needing to list them all as constants.
  if (
    requestedModel.includes('lite') ||
    requestedModel.includes('1b') ||
    requestedModel.includes('3b')
  ) {
    return requestedModel;
  }

  // Default fallback for Ollama CLI.
  return DEFAULT_OLLAMA_FLASH_MODEL;
}
