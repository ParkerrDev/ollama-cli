/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ContentGenerator } from '../core/contentGenerator.js';
import { AuthType } from '../core/contentGenerator.js';
import type { HttpOptions } from './server.js';
import { CodeAssistServer } from './server.js';
import type { Config } from '../config/config.js';
import { LoggingContentGenerator } from '../core/loggingContentGenerator.js';

export async function createCodeAssistContentGenerator(
  httpOptions: HttpOptions,
  authType: AuthType,
  config: Config,
  sessionId?: string,
): Promise<ContentGenerator> {
  // OAuth-based Code Assist is deprecated in favor of Ollama server
  throw new Error(
    `Code Assist with OAuth is no longer supported. Please use Ollama server mode (authType: ${authType}).`,
  );
}

export function getCodeAssistServer(
  config: Config,
): CodeAssistServer | undefined {
  let server = config.getContentGenerator();

  // Unwrap LoggingContentGenerator if present
  if (server instanceof LoggingContentGenerator) {
    server = server.getWrapped();
  }

  if (!(server instanceof CodeAssistServer)) {
    return undefined;
  }
  return server;
}
