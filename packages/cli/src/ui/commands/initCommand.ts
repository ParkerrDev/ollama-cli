/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  CommandContext,
  SlashCommand,
  SlashCommandActionReturn,
} from './types.js';
import { CommandKind } from './types.js';

export const initCommand: SlashCommand = {
  name: 'init',
  description: 'Analyzes the project and creates a tailored OLLAMA.md file',
  kind: CommandKind.BUILT_IN,
  action: async (
    context: CommandContext,
    _args: string,
  ): Promise<SlashCommandActionReturn> => {
    if (!context.services.config) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Configuration not available.',
      };
    }
    const targetDir = context.services.config.getTargetDir();
    const ollamaMdPath = path.join(targetDir, 'OLLAMA.md');

    if (fs.existsSync(ollamaMdPath)) {
      return {
        type: 'message',
        messageType: 'info',
        content:
          'A OLLAMA.md file already exists in this directory. No changes were made.',
      };
    }

    // Create an empty OLLAMA.md file
    fs.writeFileSync(ollamaMdPath, '', 'utf8');

    context.ui.addItem(
      {
        type: 'info',
        text: 'Empty OLLAMA.md created. Now analyzing the project to populate it.',
      },
      Date.now(),
    );

    return {
      type: 'submit_prompt',
      content: `Analyze the current directory and create a comprehensive OLLAMA.md file.

STEP 1: Explore the project
- Use list_directory to see the file structure
- Read key files like README.md, package.json, Cargo.toml, etc.
- Read a few important source files to understand the codebase

STEP 2: Identify project type
- Is this a code project (has package.json, Cargo.toml, go.mod, etc.)?
- Or is this documentation/notes/research?

STEP 3: Generate content
Based on your analysis, prepare markdown content with:
- Project overview (purpose, technologies, architecture)
- Building and running instructions
- Development conventions
- Key files and their purposes

STEP 4: Write to file
Use the write_file tool to write your generated content to ./OLLAMA.md

Remember: You MUST call write_file('./OLLAMA.md', <your-content>) - do not just show me the content!`,
    };
  },
};
