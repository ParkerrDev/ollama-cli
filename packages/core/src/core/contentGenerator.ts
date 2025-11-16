/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  CountTokensResponse,
  GenerateContentResponse,
  GenerateContentParameters,
  CountTokensParameters,
  EmbedContentResponse,
  EmbedContentParameters,
} from '@google/genai';
import type { Config } from '../config/config.js';

import type { UserTierId } from '../code_assist/types.js';
import { LoggingContentGenerator } from './loggingContentGenerator.js';
import { FakeContentGenerator } from './fakeContentGenerator.js';
import { RecordingContentGenerator } from './recordingContentGenerator.js';
import { OpenAICompatibleContentGenerator } from '../adapters/index.js';

/**
 * Interface abstracting the core functionalities for generating content and counting tokens.
 */
export interface ContentGenerator {
  generateContent(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<GenerateContentResponse>;

  generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>>;

  countTokens(request: CountTokensParameters): Promise<CountTokensResponse>;

  embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse>;

  userTier?: UserTierId;
}

export enum AuthType {
  USE_OLLAMA_SERVER = 'ollama-server',
}

export type ContentGeneratorConfig = {
  apiKey?: string;
  vertexai?: boolean;
  authType?: AuthType;
  proxy?: string;
  baseUrl?: string;
  timeout?: number;
  model?: string;
};

export async function createContentGeneratorConfig(
  config: Config,
  authType: AuthType | undefined,
): Promise<ContentGeneratorConfig> {
  const ollamaBaseUrl = process.env['OLLAMA_BASE_URL'] || 'http://localhost:11434';
  const ollamaTimeout = process.env['OLLAMA_TIMEOUT'] 
    ? parseInt(process.env['OLLAMA_TIMEOUT'], 10) 
    : 60000;

  const contentGeneratorConfig: ContentGeneratorConfig = {
    authType: authType || AuthType.USE_OLLAMA_SERVER,
    proxy: config?.getProxy(),
    baseUrl: ollamaBaseUrl,
    timeout: ollamaTimeout,
  };

  return contentGeneratorConfig;
}

export async function createContentGenerator(
  config: ContentGeneratorConfig,
  gcConfig: Config,
  sessionId?: string,
): Promise<ContentGenerator> {
  const generator = await (async () => {
    if (gcConfig.fakeResponses) {
      return FakeContentGenerator.fromFile(gcConfig.fakeResponses);
    }

    // For Ollama server, we use OpenAI-compatible API
    if (config.authType === AuthType.USE_OLLAMA_SERVER) {
      const ollamaConfig = {
        ...config,
        baseUrl: `${config.baseUrl}/v1`, // Ollama uses OpenAI-compatible /v1 endpoint
        apiKey: 'dummy-key', // Ollama doesn't require API key
      };
      
      return new LoggingContentGenerator(
        new OpenAICompatibleContentGenerator(ollamaConfig),
        gcConfig,
      );
    }
    
    throw new Error(
      `Error creating contentGenerator: Unsupported authType: ${config.authType}`,
    );
  })();

  if (gcConfig.recordResponses) {
    return new RecordingContentGenerator(generator, gcConfig.recordResponses);
  }

  return generator;
}
