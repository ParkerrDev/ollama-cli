/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '@google/ollama-cli-core';
import { AuthType, debugLogger, OutputFormat } from '@google/ollama-cli-core';
import { USER_SETTINGS_PATH } from './config/settings.js';
import { validateAuthMethod } from './config/auth.js';
import { type LoadedSettings } from './config/settings.js';
import { handleError } from './utils/errors.js';

function getAuthTypeFromEnv(): AuthType | undefined {
  // Only Ollama Server is supported now, check for OLLAMA_BASE_URL
  if (process.env['OLLAMA_BASE_URL']) {
    return AuthType.USE_OLLAMA_SERVER;
  }
  // Default to Ollama Server
  return AuthType.USE_OLLAMA_SERVER;
}

export async function validateNonInteractiveAuth(
  configuredAuthType: AuthType | undefined,
  useExternalAuth: boolean | undefined,
  nonInteractiveConfig: Config,
  settings: LoadedSettings,
) {
  try {
    const effectiveAuthType = configuredAuthType || getAuthTypeFromEnv();

    const enforcedType = settings.merged.security?.auth?.enforcedType;
    if (enforcedType && effectiveAuthType !== enforcedType) {
      const message = effectiveAuthType
        ? `The enforced authentication type is '${enforcedType}', but the current type is '${effectiveAuthType}'. Please re-authenticate with the correct type.`
        : `The auth type '${enforcedType}' is enforced, but no authentication is configured.`;
      throw new Error(message);
    }

    if (!effectiveAuthType) {
      const message = `Please set an Auth method in your ${USER_SETTINGS_PATH} or specify one of the following environment variables before running: OLLAMA_API_KEY, GOOGLE_GENAI_USE_VERTEXAI, GOOGLE_GENAI_USE_GCA`;
      throw new Error(message);
    }

    const authType: AuthType = effectiveAuthType as AuthType;

    if (!useExternalAuth) {
      const err = validateAuthMethod(String(authType));
      if (err != null) {
        throw new Error(err);
      }
    }

    await nonInteractiveConfig.refreshAuth(authType);
    return nonInteractiveConfig;
  } catch (error) {
    if (nonInteractiveConfig.getOutputFormat() === OutputFormat.JSON) {
      handleError(
        error instanceof Error ? error : new Error(String(error)),
        nonInteractiveConfig,
        1,
      );
    } else {
      debugLogger.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }
}
