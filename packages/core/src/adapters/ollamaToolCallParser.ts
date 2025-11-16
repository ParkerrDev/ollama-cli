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
    
    // Try function call format
    if (calls.length === 0) {
      const functionCalls = this.parseFunctionCallFormat(text);
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
          const normalizedArgs = this.normalizeArguments(parsed.arguments, parsed.name);
          calls.push({
            name: parsed.name,
            args: normalizedArgs,
          });
        }
        // Handle {"tool": "...", "args": {...}} format
        else if (parsed.tool && parsed.args) {
          const normalizedArgs = this.normalizeArguments(parsed.args, parsed.tool);
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
  private normalizeArguments(args: Record<string, unknown>, toolName: string): Record<string, unknown> {
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
    const jsonPattern = /\{[^{}]*"tool"\s*:\s*"([^"]+)"[^{}]*"args"\s*:\s*\{[^{}]*\}[^{}]*\}/g;
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
    const codeBlockPattern = /```(?:json)?\s*\n(\{[^`]*(?:"tool"|"name")[^`]*\})\s*\n```/g;
    while ((match = codeBlockPattern.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        
        // Handle {"name": "...", "arguments": {...}} format
        if (parsed.name && parsed.arguments) {
          const normalizedArgs = this.normalizeArguments(parsed.arguments, parsed.name);
          calls.push({
            name: parsed.name,
            args: normalizedArgs,
          });
        }
        // Handle {"tool": "...", "args": {...}} format
        else if (parsed.tool && parsed.args) {
          const normalizedArgs = this.normalizeArguments(parsed.args, parsed.tool);
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
   * Parse function call format
   * Format: tool_name('arg1', 'arg2', key='value')
   */
  private parseFunctionCallFormat(text: string): FunctionCall[] {
    const calls: FunctionCall[] = [];
    
    // Common tool names to look for
    const toolNames = [
      'write_file',
      'read_file',
      'list_directory',
      'run_shell_command',
      'replace_in_file',
      'edit_file',
      'search_files',
      'web_search',
    ];
    
    for (const toolName of toolNames) {
      const matches = this.extractFunctionCalls(text, toolName);
      calls.push(...matches);
    }
    
    return calls;
  }

  /**
   * Extract function calls for a specific tool name
   */
  private extractFunctionCalls(text: string, toolName: string): FunctionCall[] {
    const calls: FunctionCall[] = [];
    
    // Pattern to match: tool_name(...)
    // This is complex because we need to handle nested parentheses and quotes
    const pattern = new RegExp(`${toolName}\\s*\\(([^)]*)\\)`, 'g');
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      const argsString = match[1];
      const args = this.parseArguments(argsString, toolName);
      
      if (args) {
        calls.push({
          name: toolName,
          args,
        });
      }
    }
    
    // Also look in code blocks
    const codeBlockPattern = new RegExp(
      '```[^`]*' + toolName + '\\s*\\(([^)]*)\\)[^`]*```',
      'g'
    );
    
    while ((match = codeBlockPattern.exec(text)) !== null) {
      const argsString = match[1];
      const args = this.parseArguments(argsString, toolName);
      
      if (args) {
        calls.push({
          name: toolName,
          args,
        });
      }
    }
    
    return calls;
  }

  /**
   * Parse function arguments from string
   * Supports: 'arg1', 'arg2' or key='value', key2='value2'
   */
  private parseArguments(argsString: string, toolName: string): Record<string, unknown> | null {
    try {
      const args: Record<string, unknown> = {};
      
      // Try to parse as key=value pairs first
      const keyValuePattern = /(\w+)\s*=\s*(['"`])((?:\\.|(?!\2).)*)\2/g;
      let match;
      let hasKeyValue = false;
      
      while ((match = keyValuePattern.exec(argsString)) !== null) {
        const [, key, , value] = match;
        // Normalize parameter names
        const normalizedKey = this.normalizeParamName(key, toolName);
        args[normalizedKey] = value;
        hasKeyValue = true;
      }
      
      if (hasKeyValue) {
        return args;
      }
      
      // Try positional arguments for common patterns
      const cleaned = argsString.trim();
      
      // For write_file: write_file(path, content)
      if (cleaned.includes(',')) {
        const parts = this.splitArguments(cleaned);
        
        if (parts.length === 2) {
          // Map to correct parameter names based on tool
          const param1 = this.getPositionalParamName(toolName, 0);
          const param2 = this.getPositionalParamName(toolName, 1);
          args[param1] = this.unquoteString(parts[0]);
          args[param2] = this.unquoteString(parts[1]);
          return args;
        } else if (parts.length === 1) {
          // Single argument
          const param1 = this.getPositionalParamName(toolName, 0);
          args[param1] = this.unquoteString(parts[0]);
          return args;
        }
      } else if (cleaned.length > 0) {
        // Single argument without comma
        const param1 = this.getPositionalParamName(toolName, 0);
        args[param1] = this.unquoteString(cleaned);
        return args;
      }
      
      return null;
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
   * Get the correct parameter name for positional arguments
   */
  private getPositionalParamName(toolName: string, position: number): string {
    const toolParamMap: Record<string, string[]> = {
      'write_file': ['file_path', 'content'],
      'read_file': ['file_path', 'offset', 'limit'],
      'list_directory': ['dir_path'],
      'run_shell_command': ['command'],
      'edit_file': ['file_path', 'old_string', 'new_string'],
      'replace_in_file': ['file_path', 'old_string', 'new_string'],
      'search_files': ['query'],
      'web_search': ['query'],
    };
    
    const params = toolParamMap[toolName];
    if (params && position < params.length) {
      return params[position];
    }
    
    // Fallback to generic names
    return position === 0 ? 'file_path' : position === 1 ? 'content' : `arg${position}`;
  }

  /**
   * Split arguments respecting quotes
   */
  private splitArguments(argsString: string): string[] {
    const parts: string[] = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';
    let escaped = false;
    
    for (let i = 0; i < argsString.length; i++) {
      const char = argsString[i];
      
      if (escaped) {
        current += char;
        escaped = false;
        continue;
      }
      
      if (char === '\\') {
        escaped = true;
        current += char;
        continue;
      }
      
      if ((char === '"' || char === "'" || char === '`') && !inQuote) {
        inQuote = true;
        quoteChar = char;
        current += char;
        continue;
      }
      
      if (char === quoteChar && inQuote) {
        inQuote = false;
        quoteChar = '';
        current += char;
        continue;
      }
      
      if (char === ',' && !inQuote) {
        if (current.trim()) {
          parts.push(current.trim());
        }
        current = '';
        continue;
      }
      
      current += char;
    }
    
    if (current.trim()) {
      parts.push(current.trim());
    }
    
    return parts;
  }

  /**
   * Remove quotes from a string
   */
  private unquoteString(str: string): string {
    const trimmed = str.trim();
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('`') && trimmed.endsWith('`'))
    ) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  }

  /**
   * Check if text contains potential tool calls
   */
  public hasToolCalls(text: string): boolean {
    // Quick heuristic checks
    if ((text.includes('<xml>') && text.includes('</xml>')) || 
        (text.includes('<tools>') && text.includes('</tools>'))) {
      return true;
    }
    if (text.includes('"tool"') || (text.includes('"name"') && text.includes('"arguments"'))) {
      return true;
    }
    if (text.includes('write_file(') || text.includes('read_file(')) {
      return true;
    }
    
    const toolPattern = /(write_file|read_file|list_directory|run_shell_command)\s*\(/;
    return toolPattern.test(text);
  }
}
