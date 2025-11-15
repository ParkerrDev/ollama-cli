/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { FileDiscoveryService } from './fileDiscoveryService.js';

describe('FileDiscoveryService', () => {
  let testRootDir: string;
  let projectRoot: string;

  async function createTestFile(filePath: string, content = '') {
    const fullPath = path.join(projectRoot, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content);
    return fullPath;
  }

  beforeEach(async () => {
    testRootDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'file-discovery-test-'),
    );
    projectRoot = path.join(testRootDir, 'project');
    await fs.mkdir(projectRoot, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testRootDir, { recursive: true, force: true });
  });

  describe('initialization', () => {
    it('should initialize git ignore parser by default in a git repo', async () => {
      await fs.mkdir(path.join(projectRoot, '.git'));
      await createTestFile('.gitignore', 'node_modules/');

      const service = new FileDiscoveryService(projectRoot);
      // Let's check the effect of the parser instead of mocking it.
      expect(service.shouldIgnoreFile('node_modules/foo.js')).toBe(true);
      expect(service.shouldIgnoreFile('src/foo.js')).toBe(false);
    });

    it('should not load git repo patterns when not in a git repo', async () => {
      // No .git directory
      await createTestFile('.gitignore', 'node_modules/');
      const service = new FileDiscoveryService(projectRoot);

      // .gitignore is not loaded in non-git repos
      expect(service.shouldIgnoreFile('node_modules/foo.js')).toBe(false);
    });

    it('should load .ollamaignore patterns even when not in a git repo', async () => {
      await createTestFile('.ollamaignore', 'secrets.txt');
      const service = new FileDiscoveryService(projectRoot);

      expect(service.shouldIgnoreFile('secrets.txt')).toBe(true);
      expect(service.shouldIgnoreFile('src/index.js')).toBe(false);
    });
  });

  describe('filterFiles', () => {
    beforeEach(async () => {
      await fs.mkdir(path.join(projectRoot, '.git'));
      await createTestFile('.gitignore', 'node_modules/\n.git/\ndist');
      await createTestFile('.ollamaignore', 'logs/');
    });

    it('should filter out git-ignored and ollama-ignored files by default', () => {
      const files = [
        'src/index.ts',
        'node_modules/package/index.js',
        'README.md',
        '.git/config',
        'dist/bundle.js',
        'logs/latest.log',
      ].map((f) => path.join(projectRoot, f));

      const service = new FileDiscoveryService(projectRoot);

      expect(service.filterFiles(files)).toEqual(
        ['src/index.ts', 'README.md'].map((f) => path.join(projectRoot, f)),
      );
    });

    it('should not filter files when respectGitIgnore is false', () => {
      const files = [
        'src/index.ts',
        'node_modules/package/index.js',
        '.git/config',
        'logs/latest.log',
      ].map((f) => path.join(projectRoot, f));

      const service = new FileDiscoveryService(projectRoot);

      const filtered = service.filterFiles(files, {
        respectGitIgnore: false,
        respectOllamaIgnore: true, // still respect this one
      });

      expect(filtered).toEqual(
        ['src/index.ts', 'node_modules/package/index.js', '.git/config'].map(
          (f) => path.join(projectRoot, f),
        ),
      );
    });

    it('should not filter files when respectOllamaIgnore is false', () => {
      const files = [
        'src/index.ts',
        'node_modules/package/index.js',
        'logs/latest.log',
      ].map((f) => path.join(projectRoot, f));

      const service = new FileDiscoveryService(projectRoot);

      const filtered = service.filterFiles(files, {
        respectGitIgnore: true,
        respectOllamaIgnore: false,
      });

      expect(filtered).toEqual(
        ['src/index.ts', 'logs/latest.log'].map((f) =>
          path.join(projectRoot, f),
        ),
      );
    });

    it('should handle empty file list', () => {
      const service = new FileDiscoveryService(projectRoot);

      expect(service.filterFiles([])).toEqual([]);
    });
  });

  describe('filterFilesWithReport', () => {
    beforeEach(async () => {
      await fs.mkdir(path.join(projectRoot, '.git'));
      await createTestFile('.gitignore', 'node_modules/');
      await createTestFile('.ollamaignore', '*.log');
    });

    it('should return filtered paths and correct ignored count', () => {
      const files = [
        'src/index.ts',
        'node_modules/package/index.js',
        'debug.log',
        'README.md',
      ].map((f) => path.join(projectRoot, f));

      const service = new FileDiscoveryService(projectRoot);
      const report = service.filterFilesWithReport(files);

      expect(report.filteredPaths).toEqual(
        ['src/index.ts', 'README.md'].map((f) => path.join(projectRoot, f)),
      );
      expect(report.ignoredCount).toBe(2);
    });

    it('should handle no ignored files', () => {
      const files = ['src/index.ts', 'README.md'].map((f) =>
        path.join(projectRoot, f),
      );

      const service = new FileDiscoveryService(projectRoot);
      const report = service.filterFilesWithReport(files);

      expect(report.filteredPaths).toEqual(files);
      expect(report.ignoredCount).toBe(0);
    });
  });

  describe('shouldGitIgnoreFile & shouldOllamaIgnoreFile', () => {
    beforeEach(async () => {
      await fs.mkdir(path.join(projectRoot, '.git'));
      await createTestFile('.gitignore', 'node_modules/');
      await createTestFile('.ollamaignore', '*.log');
    });

    it('should return true for git-ignored files', () => {
      const service = new FileDiscoveryService(projectRoot);

      expect(
        service.shouldIgnoreFile(
          path.join(projectRoot, 'node_modules/package/index.js'),
        ),
      ).toBe(true);
    });

    it('should return false for non-git-ignored files', () => {
      const service = new FileDiscoveryService(projectRoot);

      expect(
        service.shouldIgnoreFile(path.join(projectRoot, 'src/index.ts')),
      ).toBe(false);
    });

    it('should return true for ollama-ignored files', () => {
      const service = new FileDiscoveryService(projectRoot);

      expect(
        service.shouldIgnoreFile(path.join(projectRoot, 'debug.log')),
      ).toBe(true);
    });

    it('should return false for non-ollama-ignored files', () => {
      const service = new FileDiscoveryService(projectRoot);

      expect(
        service.shouldIgnoreFile(path.join(projectRoot, 'src/index.ts')),
      ).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle relative project root paths', async () => {
      await fs.mkdir(path.join(projectRoot, '.git'));
      await createTestFile('.gitignore', 'ignored.txt');
      const service = new FileDiscoveryService(
        path.relative(process.cwd(), projectRoot),
      );

      expect(
        service.shouldIgnoreFile(path.join(projectRoot, 'ignored.txt')),
      ).toBe(true);
      expect(
        service.shouldIgnoreFile(path.join(projectRoot, 'not-ignored.txt')),
      ).toBe(false);
    });

    it('should handle filterFiles with undefined options', async () => {
      await fs.mkdir(path.join(projectRoot, '.git'));
      await createTestFile('.gitignore', 'ignored.txt');
      const service = new FileDiscoveryService(projectRoot);

      const files = ['src/index.ts', 'ignored.txt'].map((f) =>
        path.join(projectRoot, f),
      );

      expect(service.filterFiles(files, undefined)).toEqual([
        path.join(projectRoot, 'src/index.ts'),
      ]);
    });
  });
  describe('precedence (.ollamaignore over .gitignore)', () => {
    beforeEach(async () => {
      await fs.mkdir(path.join(projectRoot, '.git'));
    });

    it('should un-ignore a file in .ollamaignore that is ignored in .gitignore', async () => {
      await createTestFile('.gitignore', '*.txt');
      await createTestFile('.ollamaignore', '!important.txt');

      const service = new FileDiscoveryService(projectRoot);
      const files = ['file.txt', 'important.txt'].map((f) =>
        path.join(projectRoot, f),
      );

      const filtered = service.filterFiles(files);
      expect(filtered).toEqual([path.join(projectRoot, 'important.txt')]);
    });

    it('should un-ignore a directory in .ollamaignore that is ignored in .gitignore', async () => {
      await createTestFile('.gitignore', 'logs/');
      await createTestFile('.ollamaignore', '!logs/');

      const service = new FileDiscoveryService(projectRoot);
      const files = ['logs/app.log', 'other/app.log'].map((f) =>
        path.join(projectRoot, f),
      );

      const filtered = service.filterFiles(files);
      expect(filtered).toEqual(files);
    });

    it('should extend ignore rules in .ollamaignore', async () => {
      await createTestFile('.gitignore', '*.log');
      await createTestFile('.ollamaignore', 'temp/');

      const service = new FileDiscoveryService(projectRoot);
      const files = ['app.log', 'temp/file.txt'].map((f) =>
        path.join(projectRoot, f),
      );

      const filtered = service.filterFiles(files);
      expect(filtered).toEqual([]);
    });

    it('should use .gitignore rules if respectOllamaIgnore is false', async () => {
      await createTestFile('.gitignore', '*.txt');
      await createTestFile('.ollamaignore', '!important.txt');

      const service = new FileDiscoveryService(projectRoot);
      const files = ['file.txt', 'important.txt'].map((f) =>
        path.join(projectRoot, f),
      );

      const filtered = service.filterFiles(files, {
        respectGitIgnore: true,
        respectOllamaIgnore: false,
      });

      expect(filtered).toEqual([]);
    });

    it('should use .ollamaignore rules if respectGitIgnore is false', async () => {
      await createTestFile('.gitignore', '*.txt');
      await createTestFile('.ollamaignore', '!important.txt\ntemp/');

      const service = new FileDiscoveryService(projectRoot);
      const files = ['file.txt', 'important.txt', 'temp/file.js'].map((f) =>
        path.join(projectRoot, f),
      );

      const filtered = service.filterFiles(files, {
        respectGitIgnore: false,
        respectOllamaIgnore: true,
      });

      // .gitignore is ignored, so *.txt is not applied.
      // .ollamaignore un-ignores important.txt (which wasn't ignored anyway)
      // and ignores temp/
      expect(filtered).toEqual(
        ['file.txt', 'important.txt'].map((f) => path.join(projectRoot, f)),
      );
    });
  });
});
