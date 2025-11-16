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

interface OpenAIMessage {
  role: string;
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export class OpenAICompatibleContentGenerator implements ContentGenerator {
  constructor(protected config: ContentGeneratorConfig) {}

  /**
   * Converts Gemini-style request to OpenAI-compatible format
   */
  protected convertToOpenAIFormat(request: any): OpenAIRequest {
    const messages: OpenAIMessage[] = [];

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

    return {
      model: request.model || this.config.model || 'llama3.2',
      messages,
      temperature: request.generationConfig?.temperature,
      max_tokens: request.generationConfig?.maxOutputTokens,
    };
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
   * Converts OpenAI response to Gemini format
   */
  protected convertFromOpenAIFormat(openAIResponse: any, isStreaming = false): any {
    if (isStreaming) {
      const choice = openAIResponse.choices?.[0];
      if (!choice) return null;

      const delta = choice.delta;
      if (!delta?.content) return null;

      return {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [{ text: delta.content }],
            },
            finishReason: choice.finish_reason || undefined,
          },
        ],
        text: delta.content,
        data: {},
        functionCalls: [],
        executableCode: [],
        codeExecutionResult: [],
      };
    }

    const choice = openAIResponse.choices?.[0];
    if (!choice) {
      throw new Error('No choices in OpenAI response');
    }

    return {
      candidates: [
        {
          content: {
            role: 'model',
            parts: [{ text: choice.message.content }],
          },
          finishReason: choice.finish_reason || 'STOP',
        },
      ],
      usageMetadata: openAIResponse.usage
        ? {
            promptTokenCount: openAIResponse.usage.prompt_tokens,
            candidatesTokenCount: openAIResponse.usage.completion_tokens,
            totalTokenCount: openAIResponse.usage.total_tokens,
          }
        : undefined,
      text: choice.message.content,
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
    const openAIRequest = this.convertToOpenAIFormat(request);
    const endpoint = `${this.config.baseUrl}/chat/completions`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { Authorization: `Bearer ${this.config.apiKey}` }),
      },
      body: JSON.stringify(openAIRequest),
      signal: this.config.timeout ? AbortSignal.timeout(this.config.timeout) : undefined,
    });

    if (!response.ok) {
      const errorMsg = await response.text();
      throw new Error(`Ollama API Error: ${response.status} - ${errorMsg}`);
    }

    const data = await response.json();
    return this.convertFromOpenAIFormat(data);
  }

  async generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const self = this;
    const openAIRequest = this.convertToOpenAIFormat(request);
    const endpoint = `${this.config.baseUrl}/chat/completions`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { Authorization: `Bearer ${this.config.apiKey}` }),
      },
      body: JSON.stringify({ ...openAIRequest, stream: true }),
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
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') {
                return;
              }

              try {
                const parsed = JSON.parse(data);
                const convertedResponse = self.convertFromOpenAIFormat(parsed, true);
                if (convertedResponse) {
                  yield convertedResponse;
                }
              } catch (e) {
                // Skip invalid JSON chunks
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }

    return generator();
  }

  async countTokens(request: CountTokensParameters): Promise<CountTokensResponse> {
    // Approximate token counting for Ollama
    const contents: any = request.contents;
    const text = Array.isArray(contents) && contents.length > 0 
      ? this.partsToText(contents[0]?.parts || [])
      : '';
    const approximateTokens = Math.ceil(text.length / 4); // Rough estimate: 1 token ≈ 4 chars

    return {
      totalTokens: approximateTokens,
    };
  }

  async embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse> {
    throw new Error('Embeddings not yet implemented for Ollama');
  }
}
