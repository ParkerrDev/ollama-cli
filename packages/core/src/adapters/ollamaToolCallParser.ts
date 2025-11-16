/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { FunctionCall } from '@google/genai';

/**
 * Parses tool calls from Ollama's natural language output.
 * Supports multiple formats:
 * 1. JSON format: {"tool": "write_file", "args": {"path": "...", "content": "..."}}
 * 2. Function call format: write_file('./path', 'content')
 * 3. Python-like format: write_file(path='./path', content='content')
 * 4. Markdown code blocks with tool calls
 */
export class OllamaToolCallParser {
  /**
   * Extract tool calls from text content
   */
  public parseToolCalls(text: string): FunctionCall[] {
    const calls: FunctionCall[] = [];

    // Try XML-wrapped JSON format first (used by some Ollama models)
    const xmlCalls = this.parseXMLWrappedJSON(text);
    calls.push(...xmlCalls);

    // Try JSON format (most reliable)
    if (calls.length === 0) {
      const jsonCalls = this.parseJSONToolCalls(text);
      calls.push(...jsonCalls);
    }

    // Try direct function call format as last resort
    // Only matches at start of line or after specific markers
    if (calls.length === 0) {
      const functionCalls = this.parseDirectFunctionCalls(text);
      calls.push(...functionCalls);
    }

    return calls;
  }

  /**
   * Parse XML-wrapped JSON tool calls
   * Format: <xml>{"name": "write_file", "arguments": {...}}</xml>
   * Or: <tools>{"name": "list_directory", "arguments": {...}}</tools>
   */
  private parseXMLWrappedJSON(text: string): FunctionCall[] {
    const calls: FunctionCall[] = [];

    // Match <xml>...</xml> or <tools>...</tools> blocks
    const xmlPattern = /<(?:xml|tools)>\s*(\{[\s\S]*?\})\s*<\/(?:xml|tools)>/g;
    let match;

    while ((match = xmlPattern.exec(text)) !== null) {
      try {
        const jsonStr = match[1].trim();
        const parsed = JSON.parse(jsonStr);

        // Handle {"name": "...", "arguments": {...}} format
        if (parsed.name && parsed.arguments) {
          const normalizedArgs = this.normalizeArguments(
            parsed.arguments,
            parsed.name,
          );
          calls.push({
            name: parsed.name,
            args: normalizedArgs,
          });
        }
        // Handle {"tool": "...", "args": {...}} format
        else if (parsed.tool && parsed.args) {
          const normalizedArgs = this.normalizeArguments(
            parsed.args,
            parsed.tool,
          );
          calls.push({
            name: parsed.tool,
            args: normalizedArgs,
          });
        }
      } catch (e) {
        console.error('Failed to parse XML-wrapped JSON:', match[1], e);
        continue;
      }
    }

    return calls;
  }

  /**
   * Normalize argument keys to match tool schemas
   */
  private normalizeArguments(
    args: Record<string, unknown>,
    toolName: string,
  ): Record<string, unknown> {
    const normalized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(args)) {
      const normalizedKey = this.normalizeParamName(key, toolName);
      normalized[normalizedKey] = value;
    }

    return normalized;
  }

  /**
   * Parse JSON-formatted tool calls
   * Format: {"tool": "write_file", "args": {"path": "...", "content": "..."}}
   */
  private parseJSONToolCalls(text: string): FunctionCall[] {
    const calls: FunctionCall[] = [];

    // Match JSON objects with "tool" and "args" keys
    const jsonPattern =
      /\{[^{}]*"tool"\s*:\s*"([^"]+)"[^{}]*"args"\s*:\s*\{[^{}]*\}[^{}]*\}/g;
    let match;

    while ((match = jsonPattern.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(match[0]);
        if (parsed.tool && parsed.args) {
          calls.push({
            name: parsed.tool,
            args: parsed.args,
          });
        }
      } catch (e) {
        // Skip invalid JSON
        continue;
      }
    }

    // Also look for tool calls in code blocks
    // Format: ```json\n{"tool": "...", "args": {...}}\n```
    // Or: ```json\n{"name": "...", "arguments": {...}}\n```
    const codeBlockPattern =
      /```(?:json)?\s*\n(\{[^`]*(?:"tool"|"name")[^`]*\})\s*\n```/g;
    while ((match = codeBlockPattern.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);

        // Handle {"name": "...", "arguments": {...}} format
        if (parsed.name && parsed.arguments) {
          const normalizedArgs = this.normalizeArguments(
            parsed.arguments,
            parsed.name,
          );
          calls.push({
            name: parsed.name,
            args: normalizedArgs,
          });
        }
        // Handle {"tool": "...", "args": {...}} format
        else if (parsed.tool && parsed.args) {
          const normalizedArgs = this.normalizeArguments(
            parsed.args,
            parsed.tool,
          );
          calls.push({
            name: parsed.tool,
            args: normalizedArgs,
          });
        }
      } catch (e) {
        continue;
      }
    }

    return calls;
  }

  /**
   * Parse direct function call format
   * Format: write_file('./path', 'content') or read_file('/path/to/file')
   * Only matches at start of line or after whitespace to avoid prose matches
   */
  private parseDirectFunctionCalls(text: string): FunctionCall[] {
    const calls: FunctionCall[] = [];

    // Tool names we recognize
    const toolNames = [
      'write_file',
      'read_file',
      'list_directory',
      'run_shell_command',
    ];

    for (const toolName of toolNames) {
      // Match tool_name(...) at start of line or after whitespace
      // Use multiline flag and lookahead to ensure it's not in prose
      const pattern = new RegExp(
        `(?:^|\\s)${toolName}\\s*\\(([^)]*(?:\\([^)]*\\)[^)]*)*)\\)`,
        'gm'
      );
      let match;

      while ((match = pattern.exec(text)) !== null) {
        const argsString = match[1];
        const args = this.parseSimpleArguments(argsString, toolName);

        if (args) {
          calls.push({
            name: toolName,
            args,
          });
        }
      }
    }

    return calls;
  }

  /**
   * Parse simple function arguments
   * Handles: 'arg1', 'arg2' or "arg1", "arg2"
   */
  private parseSimpleArguments(
    argsString: string,
    toolName: string,
  ): Record<string, unknown> | null {
    try {
      // Extract quoted strings
      const stringPattern = /(['"`])((?:\\.|(?!\1).)*?)\1/g;
      const matches: string[] = [];
      let match;

      while ((match = stringPattern.exec(argsString)) !== null) {
        matches.push(match[2]); // The content inside quotes
      }

      if (matches.length === 0) {
        return null;
      }

      // Map positional arguments to parameter names
      const args: Record<string, unknown> = {};

      if (toolName === 'write_file' && matches.length >= 2) {
        args['file_path'] = matches[0];
        args['content'] = matches[1];
      } else if (toolName === 'read_file' && matches.length >= 1) {
        args['file_path'] = matches[0];
      } else if (toolName === 'list_directory' && matches.length >= 1) {
        args['dir_path'] = matches[0];
      } else if (toolName === 'run_shell_command' && matches.length >= 1) {
        args['command'] = matches[0];
      } else {
        return null;
      }

      return args;
    } catch (e) {
      return null;
    }
  }

  /**
   * Normalize parameter names to match actual tool schemas
   */
  private normalizeParamName(param: string, toolName: string): string {
    // Common mappings
    if (param === 'path' || param === 'filepath' || param === 'file') {
      return 'file_path';
    }
    if (param === 'cmd' || param === 'command') {
      return 'command';
    }
    if (param === 'dir' || param === 'directory' || param === 'folder') {
      return 'dir_path';
    }
    return param;
  }

  /**
   * Check if text contains potential tool calls
   */
  public hasToolCalls(text: string): boolean {
    // Quick heuristic checks
    if (
      (text.includes('<xml>') && text.includes('</xml>')) ||
      (text.includes('<tools>') && text.includes('</tools>'))
    ) {
      return true;
    }
    if (
      text.includes('"tool"') ||
      (text.includes('"name"') && text.includes('"arguments"'))
    ) {
      return true;
    }
    if (text.includes('write_file(') || text.includes('read_file(')) {
      return true;
    }

    const toolPattern =
      /(write_file|read_file|list_directory|run_shell_command)\s*\(/;
    return toolPattern.test(text);
  }
}
