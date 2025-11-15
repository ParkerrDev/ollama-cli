/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GitIgnoreFilter } from '../utils/gitIgnoreParser.js';
import type { OllamaIgnoreFilter } from '../utils/ollamaIgnoreParser.js';
import { GitIgnoreParser } from '../utils/gitIgnoreParser.js';
import { OllamaIgnoreParser } from '../utils/ollamaIgnoreParser.js';
import { isGitRepository } from '../utils/gitUtils.js';
import * as path from 'node:path';

export interface FilterFilesOptions {
  respectGitIgnore?: boolean;
  respectOllamaIgnore?: boolean;
}

export interface FilterReport {
  filteredPaths: string[];
  ignoredCount: number;
}

export class FileDiscoveryService {
  private gitIgnoreFilter: GitIgnoreFilter | null = null;
  private ollamaIgnoreFilter: OllamaIgnoreFilter | null = null;
  private combinedIgnoreFilter: GitIgnoreFilter | null = null;
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = path.resolve(projectRoot);
    if (isGitRepository(this.projectRoot)) {
      this.gitIgnoreFilter = new GitIgnoreParser(this.projectRoot);
    }
    this.ollamaIgnoreFilter = new OllamaIgnoreParser(this.projectRoot);

    if (this.gitIgnoreFilter) {
      const ollamaPatterns = this.ollamaIgnoreFilter.getPatterns();
      // Create combined parser: .gitignore + .ollamaignore
      this.combinedIgnoreFilter = new GitIgnoreParser(
        this.projectRoot,
        ollamaPatterns,
      );
    }
  }

  /**
   * Filters a list of file paths based on git ignore rules
   */
  filterFiles(filePaths: string[], options: FilterFilesOptions = {}): string[] {
    const { respectGitIgnore = true, respectOllamaIgnore = true } = options;
    return filePaths.filter((filePath) => {
      if (
        respectGitIgnore &&
        respectOllamaIgnore &&
        this.combinedIgnoreFilter
      ) {
        return !this.combinedIgnoreFilter.isIgnored(filePath);
      }

      if (respectGitIgnore && this.gitIgnoreFilter?.isIgnored(filePath)) {
        return false;
      }
      if (respectOllamaIgnore && this.ollamaIgnoreFilter?.isIgnored(filePath)) {
        return false;
      }
      return true;
    });
  }

  /**
   * Filters a list of file paths based on git ignore rules and returns a report
   * with counts of ignored files.
   */
  filterFilesWithReport(
    filePaths: string[],
    opts: FilterFilesOptions = {
      respectGitIgnore: true,
      respectOllamaIgnore: true,
    },
  ): FilterReport {
    const filteredPaths = this.filterFiles(filePaths, opts);
    const ignoredCount = filePaths.length - filteredPaths.length;

    return {
      filteredPaths,
      ignoredCount,
    };
  }

  /**
   * Unified method to check if a file should be ignored based on filtering options
   */
  shouldIgnoreFile(
    filePath: string,
    options: FilterFilesOptions = {},
  ): boolean {
    return this.filterFiles([filePath], options).length === 0;
  }
}
