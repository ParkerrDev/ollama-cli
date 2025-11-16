/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GenerateContentResponse,
  GenerateContentParameters,
  CountTokensResponse,
  CountTokensParameters,
  EmbedContentResponse,
  EmbedContentParameters,
} from '@google/genai';
import type { ContentGenerator, ContentGeneratorConfig } from '../core/contentGenerator.js';

interface OllamaMessage {
  role: string;
  content: string;
}

interface OllamaRequest {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
  };
}

interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  done_reason?: string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export class OllamaContentGenerator implements ContentGenerator {
  constructor(protected config: ContentGeneratorConfig) {}

  /**
   * Converts Gemini-style request to Ollama format
   */
  protected convertToOllamaFormat(request: any): OllamaRequest {
    const messages: OllamaMessage[] = [];

    // Convert system instruction
    if (request.systemInstruction) {
      messages.push({
        role: 'system',
        content: this.partsToText(request.systemInstruction.parts || []),
      });
    }

    // Convert contents (chat history)
    if (request.contents && Array.isArray(request.contents)) {
      for (const content of request.contents) {
        const role = content.role === 'model' ? 'assistant' : 'user';
        messages.push({
          role,
          content: this.partsToText(content.parts || []),
        });
      }
    }

    const ollamaRequest: OllamaRequest = {
      model: request.model || this.config.model || 'llama3.2',
      messages,
    };

    // Add options if specified
    if (request.generationConfig) {
      ollamaRequest.options = {};
      if (request.generationConfig.temperature !== undefined) {
        ollamaRequest.options.temperature = request.generationConfig.temperature;
      }
      if (request.generationConfig.maxOutputTokens !== undefined) {
        ollamaRequest.options.num_predict = request.generationConfig.maxOutputTokens;
      }
    }

    return ollamaRequest;
  }

  /**
   * Converts parts array to text
   */
  protected partsToText(parts: any[]): string {
    return parts
      .map((part) => {
        if ('text' in part) {
          return part.text;
        }
        if ('functionCall' in part && part.functionCall) {
          return `[Function call: ${part.functionCall.name}]`;
        }
        if ('functionResponse' in part && part.functionResponse) {
          return `[Function response: ${part.functionResponse.name}]`;
        }
        return '';
      })
      .join('\n');
  }

  /**
   * Converts Ollama response to Gemini format
   */
  protected convertFromOllamaFormat(ollamaResponse: OllamaResponse): any {
    return {
      candidates: [
        {
          content: {
            role: 'model',
            parts: [{ text: ollamaResponse.message.content }],
          },
          finishReason: ollamaResponse.done_reason || undefined,
        },
      ],
      usageMetadata: ollamaResponse.eval_count
        ? {
            promptTokenCount: ollamaResponse.prompt_eval_count || 0,
            candidatesTokenCount: ollamaResponse.eval_count || 0,
            totalTokenCount: (ollamaResponse.prompt_eval_count || 0) + (ollamaResponse.eval_count || 0),
          }
        : undefined,
      text: ollamaResponse.message.content,
      data: {},
      functionCalls: [],
      executableCode: [],
      codeExecutionResult: [],
    };
  }

  async generateContent(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<GenerateContentResponse> {
    const ollamaRequest = this.convertToOllamaFormat(request);
    const endpoint = `${this.config.baseUrl}/api/chat`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...ollamaRequest, stream: false }),
        signal: this.config.timeout ? AbortSignal.timeout(this.config.timeout) : undefined,
      });

      if (!response.ok) {
        const errorMsg = await response.text();
        throw new Error(`Ollama API Error: ${response.status} - ${errorMsg}`);
      }

      const data: OllamaResponse = await response.json();
      return this.convertFromOllamaFormat(data);
    } catch (error) {
      if (error instanceof TypeError && error.message === 'fetch failed') {
        throw new Error(
          `Cannot connect to Ollama server at ${this.config.baseUrl}.\n\n` +
          `Please check:\n` +
          `1. Ollama is running (run: ollama serve)\n` +
          `2. The server URL is correct\n` +
          `3. Set OLLAMA_BASE_URL environment variable if using a custom URL\n` +
          `   Example: export OLLAMA_BASE_URL=http://localhost:11434`
        );
      }
      throw error;
    }
  }

  async generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const ollamaRequest = this.convertToOllamaFormat(request);
    const endpoint = `${this.config.baseUrl}/api/chat`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...ollamaRequest, stream: true }),
        signal: this.config.timeout ? AbortSignal.timeout(this.config.timeout) : undefined,
      });

      if (!response.ok) {
        const errorMsg = await response.text();
        throw new Error(`Ollama API Streaming Error: ${response.status} - ${errorMsg}`);
      }

      if (!response.body) {
        throw new Error('Streaming response body is empty!');
      }

      async function* generator(): AsyncGenerator<GenerateContentResponse> {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;

              try {
                const parsed: OllamaResponse = JSON.parse(trimmed);
                
                // Yield each chunk
                yield {
                  candidates: [
                    {
                      content: {
                        role: 'model',
                        parts: [{ text: parsed.message.content }],
                      },
                      finishReason: parsed.done ? parsed.done_reason : undefined,
                    },
                  ],
                  text: parsed.message.content,
                  data: {},
                  functionCalls: [],
                  executableCode: [],
                  codeExecutionResult: [],
                } as any;

                if (parsed.done) {
                  return;
                }
              } catch (e) {
                // Skip invalid JSON chunks
                console.error('Failed to parse Ollama response:', trimmed, e);
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      }

      return generator();
    } catch (error) {
      if (error instanceof TypeError && error.message === 'fetch failed') {
        throw new Error(
          `Cannot connect to Ollama server at ${this.config.baseUrl}.\n\n` +
          `Please check:\n` +
          `1. Ollama is running (run: ollama serve)\n` +
          `2. The server URL is correct\n` +
          `3. Set OLLAMA_BASE_URL environment variable if using a custom URL\n` +
          `   Example: export OLLAMA_BASE_URL=http://localhost:11434`
        );
      }
      throw error;
    }
  }

  async countTokens(request: CountTokensParameters): Promise<CountTokensResponse> {
    // Ollama doesn't have a dedicated token counting endpoint
    // Return an estimate based on character count (rough approximation)
    const text = JSON.stringify(request);
    const estimatedTokens = Math.ceil(text.length / 4);
    
    return {
      totalTokens: estimatedTokens,
    };
  }

  async embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse> {
    const endpoint = `${this.config.baseUrl}/api/embeddings`;
    
    // Extract text from request
    const contents: any = request.contents || [];
    const text = contents[0]?.parts?.[0]?.text || '';
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'nomic-embed-text',
          prompt: text,
        }),
        signal: this.config.timeout ? AbortSignal.timeout(this.config.timeout) : undefined,
      });

      if (!response.ok) {
        throw new Error(`Ollama embedding error: ${response.status}`);
      }

      const data = await response.json();
      return {
        embeddings: {
          values: data.embedding || [],
        },
      } as any;
    } catch (error) {
      throw new Error(`Failed to generate embeddings: ${error}`);
    }
  }
}
