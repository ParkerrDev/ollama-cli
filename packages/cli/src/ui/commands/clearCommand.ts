/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { uiTelemetryService } from '@google/ollama-cli-core';
import type { SlashCommand } from './types.js';
import { CommandKind } from './types.js';

export const clearCommand: SlashCommand = {
  name: 'clear',
  description: 'Clear the screen and conversation history',
  kind: CommandKind.BUILT_IN,
  action: async (context, _args) => {
    const ollamaClient = context.services.config?.getOllamaClient();

    if (ollamaClient) {
      context.ui.setDebugMessage('Clearing terminal and resetting chat.');
      // If resetChat fails, the exception will propagate and halt the command,
      // which is the correct behavior to signal a failure to the user.
      await ollamaClient.resetChat();
    } else {
      context.ui.setDebugMessage('Clearing terminal.');
    }

    uiTelemetryService.setLastPromptTokenCount(0);
    context.ui.clear();
  },
};
