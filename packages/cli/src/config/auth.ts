/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '@google/ollama-cli-core';
import { loadEnvironment, loadSettings } from './settings.js';

export function validateAuthMethod(authMethod: string): string | null {
  loadEnvironment(loadSettings().merged);
  
  // Ollama Server doesn't require any authentication
  if (authMethod === AuthType.USE_OLLAMA_SERVER) {
    return null;
  }

  return 'Invalid auth method selected. Only Ollama Server is supported.';
}
