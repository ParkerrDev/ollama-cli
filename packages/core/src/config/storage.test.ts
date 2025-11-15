/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    mkdirSync: vi.fn(),
  };
});

import { Storage } from './storage.js';
import { OLLAMA_DIR } from '../utils/paths.js';

describe('Storage – getGlobalSettingsPath', () => {
  it('returns path to ~/.ollama/settings.json', () => {
    const expected = path.join(os.homedir(), OLLAMA_DIR, 'settings.json');
    expect(Storage.getGlobalSettingsPath()).toBe(expected);
  });
});

describe('Storage – additional helpers', () => {
  const projectRoot = '/tmp/project';
  const storage = new Storage(projectRoot);

  it('getWorkspaceSettingsPath returns project/.ollama/settings.json', () => {
    const expected = path.join(projectRoot, OLLAMA_DIR, 'settings.json');
    expect(storage.getWorkspaceSettingsPath()).toBe(expected);
  });

  it('getUserCommandsDir returns ~/.ollama/commands', () => {
    const expected = path.join(os.homedir(), OLLAMA_DIR, 'commands');
    expect(Storage.getUserCommandsDir()).toBe(expected);
  });

  it('getProjectCommandsDir returns project/.ollama/commands', () => {
    const expected = path.join(projectRoot, OLLAMA_DIR, 'commands');
    expect(storage.getProjectCommandsDir()).toBe(expected);
  });

  it('getMcpOAuthTokensPath returns ~/.ollama/mcp-oauth-tokens.json', () => {
    const expected = path.join(
      os.homedir(),
      OLLAMA_DIR,
      'mcp-oauth-tokens.json',
    );
    expect(Storage.getMcpOAuthTokensPath()).toBe(expected);
  });

  it('getGlobalBinDir returns ~/.ollama/tmp/bin', () => {
    const expected = path.join(os.homedir(), OLLAMA_DIR, 'tmp', 'bin');
    expect(Storage.getGlobalBinDir()).toBe(expected);
  });
});
