/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SlashCommand, CommandContext } from './types.js';
import { CommandKind } from './types.js';
import { MessageType } from '../types.js';
import { OllamaModelClient, formatBytes, formatRelativeTime } from '@google/ollama-cli-core';

export const modelCommand: SlashCommand = {
  name: 'model',
  altNames: ['m'],
  description: 'Manage and switch Ollama models',
  kind: CommandKind.BUILT_IN,
  subCommands: [
    {
      name: 'list',
      altNames: ['ls'],
      description: 'List all locally available models',
      kind: CommandKind.BUILT_IN,
      action: async (context: CommandContext) => {
        const {
          ui: { addItem },
          services: { config },
        } = context;

        if (!config) {
          addItem(
            {
              type: MessageType.ERROR,
              text: 'Configuration is not available.',
            },
            Date.now(),
          );
          return;
        }

        const baseUrl = process.env['OLLAMA_BASE_URL'] || 'http://localhost:11434';
        const client = new OllamaModelClient(baseUrl);

        try {
          const models = await client.listModels();

          if (models.length === 0) {
            addItem(
              {
                type: MessageType.INFO,
                text: 'No models found.\n\nTo pull a model, use: /model pull <model-name>\nFor example: /model pull qwen2.5-coder:latest',
              },
              Date.now(),
            );
            return;
          }

          let modelList = '\n📦 Available Models:\n\n';
          modelList += 'NAME'.padEnd(35) + 'SIZE'.padEnd(15) + 'MODIFIED\n';
          modelList += '─'.repeat(70) + '\n';

          for (const model of models) {
            const name = model.name.padEnd(35);
            const size = formatBytes(model.size).padEnd(15);
            const modified = formatRelativeTime(model.modified_at);
            modelList += `${name}${size}${modified}\n`;
          }

          modelList += `\n✓ Total: ${models.length} model(s)`;

          addItem(
            {
              type: MessageType.INFO,
              text: modelList,
            },
            Date.now(),
          );
        } catch (error) {
          addItem(
            {
              type: MessageType.ERROR,
              text: `Failed to list models: ${error instanceof Error ? error.message : String(error)}\n\nMake sure Ollama server is running: ollama serve`,
            },
            Date.now(),
          );
        }
      },
    },
    {
      name: 'use',
      altNames: ['switch', 'set'],
      description: 'Switch to a different model',
      kind: CommandKind.BUILT_IN,
      action: async (context: CommandContext, args: string) => {
        const {
          ui: { addItem },
          services: { config },
        } = context;

        if (!config) {
          addItem(
            {
              type: MessageType.ERROR,
              text: 'Configuration is not available.',
            },
            Date.now(),
          );
          return;
        }

        const modelName = args.trim();
        if (!modelName) {
          addItem(
            {
              type: MessageType.ERROR,
              text: 'Please specify a model name.\nUsage: /model use <model-name>\nExample: /model use qwen2.5-coder:latest',
            },
            Date.now(),
          );
          return;
        }

        // Verify model exists
        const baseUrl = process.env['OLLAMA_BASE_URL'] || 'http://localhost:11434';
        const client = new OllamaModelClient(baseUrl);

        try {
          const models = await client.listModels();
          const modelExists = models.some(m => m.name === modelName);

          if (!modelExists) {
            addItem(
              {
                type: MessageType.ERROR,
                text: `Model '${modelName}' not found.\n\nAvailable models:\n${models.map(m => `- ${m.name}`).join('\n')}\n\nTo pull a new model, use: /model pull ${modelName}`,
              },
              Date.now(),
            );
            return;
          }

          // Switch the model
          config.setModel(modelName);

          addItem(
            {
              type: MessageType.INFO,
              text: `✓ Switched to model: ${modelName}`,
            },
            Date.now(),
          );
        } catch (error) {
          addItem(
            {
              type: MessageType.ERROR,
              text: `Failed to switch model: ${error instanceof Error ? error.message : String(error)}`,
            },
            Date.now(),
          );
        }
      },
    },
    {
      name: 'pull',
      description: 'Pull a model from the registry',
      kind: CommandKind.BUILT_IN,
      action: async (context: CommandContext, args: string) => {
        const {
          ui: { addItem },
        } = context;

        const modelName = args.trim();
        if (!modelName) {
          addItem(
            {
              type: MessageType.ERROR,
              text: 'Please specify a model name.\nUsage: /model pull <model-name>\nExample: /model pull qwen2.5-coder:latest',
            },
            Date.now(),
          );
          return;
        }

        const baseUrl = process.env['OLLAMA_BASE_URL'] || 'http://localhost:11434';
        const client = new OllamaModelClient(baseUrl);

        addItem(
          {
            type: MessageType.INFO,
            text: `📥 Pulling model: ${modelName}...\n\nThis may take a few minutes depending on the model size.`,
          },
          Date.now(),
        );

        try {
          let lastUpdate = Date.now();
          await client.pullModel(modelName, (progress) => {
            // Throttle updates to avoid flooding the UI
            if (Date.now() - lastUpdate > 1000) {
              lastUpdate = Date.now();
              if (progress.total && progress.completed) {
                const percent = ((progress.completed / progress.total) * 100).toFixed(1);
                addItem(
                  {
                    type: MessageType.INFO,
                    text: `${progress.status}: ${percent}%`,
                  },
                  Date.now(),
                );
              }
            }
          });

          addItem(
            {
              type: MessageType.INFO,
              text: `✓ Successfully pulled ${modelName}`,
            },
            Date.now(),
          );
        } catch (error) {
          addItem(
            {
              type: MessageType.ERROR,
              text: `Failed to pull model: ${error instanceof Error ? error.message : String(error)}`,
            },
            Date.now(),
          );
        }
      },
    },
    {
      name: 'show',
      altNames: ['info'],
      description: 'Show detailed information about a model',
      kind: CommandKind.BUILT_IN,
      action: async (context: CommandContext, args: string) => {
        const {
          ui: { addItem },
        } = context;

        const modelName = args.trim();
        if (!modelName) {
          addItem(
            {
              type: MessageType.ERROR,
              text: 'Please specify a model name.\nUsage: /model show <model-name>',
            },
            Date.now(),
          );
          return;
        }

        const baseUrl = process.env['OLLAMA_BASE_URL'] || 'http://localhost:11434';
        const client = new OllamaModelClient(baseUrl);

        try {
          const info = await client.showModel(modelName);

          let infoText = `\n📋 Model: ${modelName}\n\n`;
          infoText += 'Details:\n';
          infoText += `  Format: ${info.details.format}\n`;
          infoText += `  Family: ${info.details.family}\n`;
          infoText += `  Parameter Size: ${info.details.parameter_size}\n`;
          infoText += `  Quantization: ${info.details.quantization_level}\n`;

          if (info.details.parent_model) {
            infoText += `  Parent Model: ${info.details.parent_model}\n`;
          }

          infoText += '\nParameters:\n';
          infoText += info.parameters;

          addItem(
            {
              type: MessageType.INFO,
              text: infoText,
            },
            Date.now(),
          );
        } catch (error) {
          addItem(
            {
              type: MessageType.ERROR,
              text: `Failed to get model info: ${error instanceof Error ? error.message : String(error)}`,
            },
            Date.now(),
          );
        }
      },
    },
    {
      name: 'ps',
      description: 'List currently running models',
      kind: CommandKind.BUILT_IN,
      action: async (context: CommandContext) => {
        const {
          ui: { addItem },
        } = context;

        const baseUrl = process.env['OLLAMA_BASE_URL'] || 'http://localhost:11434';
        const client = new OllamaModelClient(baseUrl);

        try {
          const models = await client.listRunningModels();

          if (models.length === 0) {
            addItem(
              {
                type: MessageType.INFO,
                text: 'No models currently running.',
              },
              Date.now(),
            );
            return;
          }

          let modelList = '\n🔄 Running Models:\n\n';
          modelList += 'NAME'.padEnd(35) + 'SIZE'.padEnd(15) + 'VRAM\n';
          modelList += '─'.repeat(70) + '\n';

          for (const model of models) {
            const name = model.name.padEnd(35);
            const size = formatBytes(model.size).padEnd(15);
            const vram = formatBytes(model.size_vram);
            modelList += `${name}${size}${vram}\n`;
          }

          modelList += `\n✓ Total: ${models.length} running model(s)`;

          addItem(
            {
              type: MessageType.INFO,
              text: modelList,
            },
            Date.now(),
          );
        } catch (error) {
          addItem(
            {
              type: MessageType.ERROR,
              text: `Failed to list running models: ${error instanceof Error ? error.message : String(error)}`,
            },
            Date.now(),
          );
        }
      },
    },
  ],
};
