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
import type {
  ContentGenerator,
  ContentGeneratorConfig,
} from '../core/contentGenerator.js';
import { OllamaToolCallParser } from './ollamaToolCallParser.js';

interface OllamaMessage {
  role: string;
  content: string;
}

interface OllamaRequest {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description?: string;
      parameters?: any;
    };
  }>;
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
    tool_calls?: Array<{
      function: {
        name: string;
        arguments: string | Record<string, unknown>;
      };
    }>;
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

interface OllamaModelInfo {
  capabilities?: string[];
}

export class OllamaContentGenerator implements ContentGenerator {
  private toolCallParser: OllamaToolCallParser;
  private modelCapabilities: Map<string, OllamaModelInfo> = new Map();

  constructor(protected config: ContentGeneratorConfig) {
    this.toolCallParser = new OllamaToolCallParser();
  }

  /**
   * Check if a model supports native tool calling
   */
  private async getModelCapabilities(model: string): Promise<OllamaModelInfo> {
    // Check cache first
    if (this.modelCapabilities.has(model)) {
      return this.modelCapabilities.get(model)!;
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/api/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: model }),
      });

      if (response.ok) {
        const data = await response.json();
        const info: OllamaModelInfo = {
          capabilities: data.capabilities || [],
        };
        this.modelCapabilities.set(model, info);
        return info;
      }
    } catch (error) {
      // If we can't get model info, assume no native tools
      console.warn(`Could not fetch capabilities for model ${model}:`, error);
    }

    // Default: assume no native tools
    const defaultInfo: OllamaModelInfo = { capabilities: [] };
    this.modelCapabilities.set(model, defaultInfo);
    return defaultInfo;
  }

  /**
   * Check if model supports native tool calling
   */
  private async supportsNativeTools(model: string): Promise<boolean> {
    const info = await this.getModelCapabilities(model);
    return info.capabilities?.includes('tools') ?? false;
  }

  /**
   * Converts Gemini-style request to Ollama format
   */
  protected async convertToOllamaFormat(request: any): Promise<OllamaRequest> {
    const messages: OllamaMessage[] = [];
    const modelName = request.model || this.config.model || 'llama3.2';

    // Check if model supports native tools
    const hasNativeTools = await this.supportsNativeTools(modelName);
    const hasTools =
      request.tools && Array.isArray(request.tools) && request.tools.length > 0;

    // Build tool schemas if tools are provided and model doesn't support native tools
    let toolSchemas = '';
    if (hasTools && !hasNativeTools) {
      toolSchemas = this.buildToolSchemas(request.tools);
    }

    // Convert system instruction
    if (request.systemInstruction) {
      let systemContent = this.partsToText(
        request.systemInstruction.parts || [],
      );

      // Append tool schemas to system instruction only if not using native tools
      if (toolSchemas) {
        systemContent += '\n\n' + toolSchemas;
      }

      messages.push({
        role: 'system',
        content: systemContent,
      });
    } else if (toolSchemas) {
      // If no system instruction but we have tools, add them as system message
      messages.push({
        role: 'system',
        content: toolSchemas,
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
      model: modelName,
      messages,
    };

    // Add native tools if supported
    if (hasNativeTools && hasTools) {
      ollamaRequest.tools = this.convertToNativeTools(request.tools);
    }

    // Add options if specified
    if (request.generationConfig) {
      ollamaRequest.options = {};
      if (request.generationConfig.temperature !== undefined) {
        ollamaRequest.options.temperature =
          request.generationConfig.temperature;
      }
      if (request.generationConfig.maxOutputTokens !== undefined) {
        ollamaRequest.options.num_predict =
          request.generationConfig.maxOutputTokens;
      }
    }

    return ollamaRequest;
  }

  /**
   * Convert Gemini tools to Ollama native tool format
   */
  protected convertToNativeTools(tools: any[]): Array<{
    type: 'function';
    function: {
      name: string;
      description?: string;
      parameters?: any;
    };
  }> {
    const nativeTools: Array<{
      type: 'function';
      function: {
        name: string;
        description?: string;
        parameters?: any;
      };
    }> = [];

    for (const tool of tools) {
      if (tool.functionDeclarations) {
        for (const func of tool.functionDeclarations) {
          nativeTools.push({
            type: 'function',
            function: {
              name: func.name,
              description: func.description,
              parameters: func.parameters,
            },
          });
        }
      }
    }

    return nativeTools;
  }

  /**
   * Build tool schemas for Ollama prompt injection
   */
  protected buildToolSchemas(tools: any[]): string {
    let schemas = '## TOOL USAGE INSTRUCTIONS\n\n';
    schemas += 'When you need to use a tool, output ONLY the tool call in XML format. Example:\n\n';
    schemas += 'User: "List the files in /home/user/project"\n';
    schemas += 'You: <xml>{"name": "list_directory", "arguments": {"dir_path": "/home/user/project"}}</xml>\n\n';
    schemas += 'User: "Read the README file"\n';
    schemas += 'You: <xml>{"name": "read_file", "arguments": {"file_path": "README.md"}}</xml>\n\n';
    schemas += '**DO NOT:**\n';
    schemas += '- Write explanations or plans\n';
    schemas += '- Write example code\n';
    schemas += '- Describe what you will do\n\n';
    schemas += '**DO:**\n';
    schemas += '- Output the tool call immediately\n';
    schemas += '- Use the exact XML format shown above\n';
    schemas += '- Wait for the tool result before responding\n\n';
    schemas += '---\n\n';
    schemas += '## AVAILABLE TOOLS\n\n';

    for (const tool of tools) {
      if (tool.functionDeclarations) {
        for (const func of tool.functionDeclarations) {
          schemas += `### ${func.name}\n`;
          if (func.description) {
            schemas += `${func.description}\n\n`;
          }
          if (func.parameters && func.parameters.properties) {
            schemas += '**Parameters:**\n';
            for (const [paramName, paramInfo] of Object.entries(func.parameters.properties)) {
              const info = paramInfo as any;
              schemas += `- \`${paramName}\``;
              if (info.type) schemas += ` (${info.type})`;
              if (info.description) schemas += ` - ${info.description}`;
              schemas += '\n';
            }
            if (func.parameters.required && func.parameters.required.length > 0) {
              schemas += `\n**Required:** ${func.parameters.required.join(', ')}\n`;
            }
          }
          
          // Add usage example
          schemas += '\n**Usage:**\n';
          schemas += '```xml\n<xml>{"name": "' + func.name + '", "arguments": {';
          if (func.parameters && func.parameters.properties) {
            const exampleArgs: string[] = [];
            for (const paramName of Object.keys(func.parameters.properties)) {
              exampleArgs.push(`"${paramName}": "..."`);
            }
            schemas += exampleArgs.join(', ');
          }
          schemas += '}}</xml>\n```\n\n';
        }
      }
    }

    return schemas;
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
    const content = ollamaResponse.message.content;

    // Check for native tool calls first
    let functionCalls: any[] = [];
    if (
      ollamaResponse.message.tool_calls &&
      ollamaResponse.message.tool_calls.length > 0
    ) {
      // Model used native tool calling
      functionCalls = ollamaResponse.message.tool_calls.map((tc) => {
        // Parse arguments if they're a JSON string
        let args = tc.function.arguments;
        if (typeof args === 'string') {
          try {
            args = JSON.parse(args);
          } catch (e) {
            console.error('Failed to parse tool call arguments:', args);
            args = {};
          }
        }
        return {
          name: tc.function.name,
          args,
        };
      });
    } else {
      // Fall back to parsing tool calls from text
      functionCalls = this.toolCallParser.parseToolCalls(content);
    }

    return {
      candidates: [
        {
          content: {
            role: 'model',
            parts: [{ text: content }],
          },
          finishReason: ollamaResponse.done_reason || undefined,
        },
      ],
      usageMetadata: ollamaResponse.eval_count
        ? {
            promptTokenCount: ollamaResponse.prompt_eval_count || 0,
            candidatesTokenCount: ollamaResponse.eval_count || 0,
            totalTokenCount:
              (ollamaResponse.prompt_eval_count || 0) +
              (ollamaResponse.eval_count || 0),
          }
        : undefined,
      text: content,
      data: {},
      functionCalls,
      executableCode: [],
      codeExecutionResult: [],
    };
  }

  async generateContent(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<GenerateContentResponse> {
    const ollamaRequest = await this.convertToOllamaFormat(request);
    const endpoint = `${this.config.baseUrl}/api/chat`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...ollamaRequest, stream: false }),
        signal: this.config.timeout
          ? AbortSignal.timeout(this.config.timeout)
          : undefined,
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
            `   Example: export OLLAMA_BASE_URL=http://localhost:11434`,
        );
      }
      throw error;
    }
  }

  async generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const ollamaRequest = await this.convertToOllamaFormat(request);
    const endpoint = `${this.config.baseUrl}/api/chat`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...ollamaRequest, stream: true }),
        // Don't use timeout for streaming - it should stream indefinitely
        // The timeout only applies to the initial connection
        signal: undefined,
      });

      if (!response.ok) {
        const errorMsg = await response.text();
        let parsedError;
        try {
          parsedError = JSON.parse(errorMsg);
        } catch {
          parsedError = { error: errorMsg };
        }

        const modelInfo = ollamaRequest.model
          ? ` (model: ${ollamaRequest.model})`
          : '';
        throw new Error(
          `Ollama API Streaming Error${modelInfo}: ${response.status} - ${parsedError.error || errorMsg}`,
        );
      }

      if (!response.body) {
        throw new Error('Streaming response body is empty!');
      }

      const self = this;

      async function* generator(): AsyncGenerator<GenerateContentResponse> {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulatedText = '';

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

                // Check for error response from Ollama
                if ('error' in parsed) {
                  const errorMsg = (parsed as any).error;
                  const modelInfo = ollamaRequest.model
                    ? ` (model: ${ollamaRequest.model})`
                    : '';

                  // Provide helpful error messages for common issues
                  if (
                    errorMsg.includes('unexpected EOF') ||
                    errorMsg.includes('model not found')
                  ) {
                    throw new Error(
                      `Ollama model error${modelInfo}: ${errorMsg}\n\n` +
                        `This usually means:\n` +
                        `1. The model may be corrupted or incomplete\n` +
                        `2. The model hasn't been fully downloaded\n` +
                        `\nTry:\n` +
                        `  ollama pull ${ollamaRequest.model}\n` +
                        `  ollama list  # to see available models`,
                    );
                  }

                  throw new Error(`Ollama error${modelInfo}: ${errorMsg}`);
                }

                // Check if message exists
                if (!parsed.message) {
                  console.error(
                    'Invalid Ollama response (no message):',
                    trimmed,
                  );
                  continue;
                }

                // Accumulate text for tool call parsing
                accumulatedText += parsed.message.content;

                // Parse tool calls when done
                let functionCalls: any[] = [];
                if (parsed.done) {
                  // Check for native tool calls first
                  if (
                    parsed.message.tool_calls &&
                    parsed.message.tool_calls.length > 0
                  ) {
                    functionCalls = parsed.message.tool_calls.map((tc) => {
                      let args = tc.function.arguments;
                      if (typeof args === 'string') {
                        try {
                          args = JSON.parse(args);
                        } catch (e) {
                          console.error(
                            'Failed to parse tool call arguments:',
                            args,
                          );
                          args = {};
                        }
                      }
                      return {
                        name: tc.function.name,
                        args,
                      };
                    });
                  } else {
                    // Fall back to parsing from accumulated text
                    functionCalls =
                      self.toolCallParser.parseToolCalls(accumulatedText);
                  }
                }

                // Yield each chunk
                yield {
                  candidates: [
                    {
                      content: {
                        role: 'model',
                        parts: [{ text: parsed.message.content }],
                      },
                      finishReason: parsed.done
                        ? parsed.done_reason
                        : undefined,
                    },
                  ],
                  text: parsed.message.content,
                  data: {},
                  functionCalls,
                  executableCode: [],
                  codeExecutionResult: [],
                } as any;

                if (parsed.done) {
                  return;
                }
              } catch (e) {
                // If it's an error we threw, re-throw it
                if (
                  e instanceof Error &&
                  e.message.startsWith('Ollama error:')
                ) {
                  throw e;
                }
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
            `   Example: export OLLAMA_BASE_URL=http://localhost:11434`,
        );
      }
      throw error;
    }
  }

  async countTokens(
    request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    // Ollama doesn't have a dedicated token counting endpoint
    // Return an estimate based on character count (rough approximation)
    const text = JSON.stringify(request);
    const estimatedTokens = Math.ceil(text.length / 4);

    return {
      totalTokens: estimatedTokens,
    };
  }

  async embedContent(
    request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
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
        signal: this.config.timeout
          ? AbortSignal.timeout(this.config.timeout)
          : undefined,
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
