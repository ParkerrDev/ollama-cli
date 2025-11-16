/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Credentials, AuthClient } from 'google-auth-library';
import {
  OAuth2Client,
  CodeChallengeMethod,
} from 'google-auth-library';
import * as http from 'node:http';
import url from 'node:url';
import crypto from 'node:crypto';
import * as net from 'node:net';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { Config } from '../config/config.js';
import { getErrorMessage, FatalAuthenticationError } from '../utils/errors.js';
import { UserAccountManager } from '../utils/userAccountManager.js';
import { AuthType } from '../core/contentGenerator.js';
import readline from 'node:readline';
import { Storage } from '../config/storage.js';
import { OAuthCredentialStorage } from './oauth-credential-storage.js';
import { FORCE_ENCRYPTED_FILE_ENV_VAR } from '../mcp/token-storage/index.js';
import { debugLogger } from '../utils/debugLogger.js';

const userAccountManager = new UserAccountManager();

// OAuth Client ID used to initiate OAuth2Client class.
// Note: OAuth is deprecated and no longer used with Ollama server
// @ts-expect-error - Keeping for reference but no longer used
const OAUTH_CLIENT_ID =
  '681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com';

// OAuth Secret value used to initiate OAuth2Client class.
// Note: OAuth is deprecated and no longer used with Ollama server
// @ts-expect-error - Keeping for reference but no longer used
const OAUTH_CLIENT_SECRET = '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';

// OAuth Scopes for Cloud Code authorization.
const OAUTH_SCOPE = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

const HTTP_REDIRECT = 301;
const SIGN_IN_SUCCESS_URL =
  'https://developers.google.com/ollama-code-assist/auth_success_ollama';
const SIGN_IN_FAILURE_URL =
  'https://developers.google.com/ollama-code-assist/auth_failure_ollama';

/**
 * An Authentication URL for updating the credentials of a Oauth2Client
 * as well as a promise that will resolve when the credentials have
 * been refreshed (or which throws error when refreshing credentials failed).
 */
export interface OauthWebLogin {
  authUrl: string;
  loginCompletePromise: Promise<void>;
}

const oauthClientPromises = new Map<AuthType, Promise<AuthClient>>();

function getUseEncryptedStorageFlag() {
  return process.env[FORCE_ENCRYPTED_FILE_ENV_VAR] === 'true';
}

async function initOauthClient(
  authType: AuthType,
  config: Config,
): Promise<AuthClient> {
  // Ollama server doesn't use OAuth authentication
  // OAuth is no longer supported in this version
  throw new Error(`OAuth authentication not supported. Ollama server does not require authentication.`);
}

export async function getOauthClient(
  authType: AuthType,
  config: Config,
): Promise<AuthClient> {
  if (!oauthClientPromises.has(authType)) {
    oauthClientPromises.set(authType, initOauthClient(authType, config));
  }
  return oauthClientPromises.get(authType)!;
}

// @ts-expect-error - Deprecated OAuth function kept for reference
async function authWithUserCode(client: OAuth2Client): Promise<boolean> {
  const redirectUri = 'https://codeassist.google.com/authcode';
  const codeVerifier = await client.generateCodeVerifierAsync();
  const state = crypto.randomBytes(32).toString('hex');
  const authUrl: string = client.generateAuthUrl({
    redirect_uri: redirectUri,
    access_type: 'offline',
    scope: OAUTH_SCOPE,
    code_challenge_method: CodeChallengeMethod.S256,
    code_challenge: codeVerifier.codeChallenge,
    state,
  });
  debugLogger.log(
    'Please visit the following URL to authorize the application:',
  );
  debugLogger.log('');
  debugLogger.log(authUrl);
  debugLogger.log('');

  const code = await new Promise<string>((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question('Enter the authorization code: ', (code) => {
      rl.close();
      resolve(code.trim());
    });
  });

  if (!code) {
    debugLogger.error('Authorization code is required.');
    return false;
  }

  try {
    const { tokens } = await client.getToken({
      code,
      codeVerifier: codeVerifier.codeVerifier,
      redirect_uri: redirectUri,
    });
    client.setCredentials(tokens);
  } catch (error) {
    debugLogger.error(
      'Failed to authenticate with authorization code:',
      getErrorMessage(error),
    );
    return false;
  }
  return true;
}

// @ts-expect-error - Deprecated OAuth function kept for reference
async function authWithWeb(client: OAuth2Client): Promise<OauthWebLogin> {
  const port = await getAvailablePort();
  // The hostname used for the HTTP server binding (e.g., '0.0.0.0' in Docker).
  const host = process.env['OAUTH_CALLBACK_HOST'] || 'localhost';
  // The `redirectUri` sent to Google's authorization server MUST use a loopback IP literal
  // (i.e., 'localhost' or '127.0.0.1'). This is a strict security policy for credentials of
  // type 'Desktop app' or 'Web application' (when using loopback flow) to mitigate
  // authorization code interception attacks.
  const redirectUri = `http://localhost:${port}/oauth2callback`;
  const state = crypto.randomBytes(32).toString('hex');
  const authUrl = client.generateAuthUrl({
    redirect_uri: redirectUri,
    access_type: 'offline',
    scope: OAUTH_SCOPE,
    state,
  });

  const loginCompletePromise = new Promise<void>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        if (req.url!.indexOf('/oauth2callback') === -1) {
          res.writeHead(HTTP_REDIRECT, { Location: SIGN_IN_FAILURE_URL });
          res.end();
          reject(
            new FatalAuthenticationError(
              'OAuth callback not received. Unexpected request: ' + req.url,
            ),
          );
        }
        // acquire the code from the querystring, and close the web server.
        const qs = new url.URL(req.url!, 'http://localhost:3000').searchParams;
        if (qs.get('error')) {
          res.writeHead(HTTP_REDIRECT, { Location: SIGN_IN_FAILURE_URL });
          res.end();

          const errorCode = qs.get('error');
          const errorDescription =
            qs.get('error_description') || 'No additional details provided';
          reject(
            new FatalAuthenticationError(
              `Google OAuth error: ${errorCode}. ${errorDescription}`,
            ),
          );
        } else if (qs.get('state') !== state) {
          res.end('State mismatch. Possible CSRF attack');

          reject(
            new FatalAuthenticationError(
              'OAuth state mismatch. Possible CSRF attack or browser session issue.',
            ),
          );
        } else if (qs.get('code')) {
          try {
            const { tokens } = await client.getToken({
              code: qs.get('code')!,
              redirect_uri: redirectUri,
            });
            client.setCredentials(tokens);

            // Retrieve and cache Google Account ID during authentication
            try {
              await fetchAndCacheUserInfo(client);
            } catch (error) {
              debugLogger.warn(
                'Failed to retrieve Google Account ID during authentication:',
                getErrorMessage(error),
              );
              // Don't fail the auth flow if Google Account ID retrieval fails
            }

            res.writeHead(HTTP_REDIRECT, { Location: SIGN_IN_SUCCESS_URL });
            res.end();
            resolve();
          } catch (error) {
            res.writeHead(HTTP_REDIRECT, { Location: SIGN_IN_FAILURE_URL });
            res.end();
            reject(
              new FatalAuthenticationError(
                `Failed to exchange authorization code for tokens: ${getErrorMessage(error)}`,
              ),
            );
          }
        } else {
          reject(
            new FatalAuthenticationError(
              'No authorization code received from Google OAuth. Please try authenticating again.',
            ),
          );
        }
      } catch (e) {
        // Provide more specific error message for unexpected errors during OAuth flow
        if (e instanceof FatalAuthenticationError) {
          reject(e);
        } else {
          reject(
            new FatalAuthenticationError(
              `Unexpected error during OAuth authentication: ${getErrorMessage(e)}`,
            ),
          );
        }
      } finally {
        server.close();
      }
    });

    server.listen(port, host, () => {
      // Server started successfully
    });

    server.on('error', (err) => {
      reject(
        new FatalAuthenticationError(
          `OAuth callback server error: ${getErrorMessage(err)}`,
        ),
      );
    });
  });

  return {
    authUrl,
    loginCompletePromise,
  };
}

export function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    let port = 0;
    try {
      const portStr = process.env['OAUTH_CALLBACK_PORT'];
      if (portStr) {
        port = parseInt(portStr, 10);
        if (isNaN(port) || port <= 0 || port > 65535) {
          return reject(
            new Error(`Invalid value for OAUTH_CALLBACK_PORT: "${portStr}"`),
          );
        }
        return resolve(port);
      }
      const server = net.createServer();
      server.listen(0, () => {
        const address = server.address()! as net.AddressInfo;
        port = address.port;
      });
      server.on('listening', () => {
        server.close();
        server.unref();
      });
      server.on('error', (e) => reject(e));
      server.on('close', () => resolve(port));
    } catch (e) {
      reject(e);
    }
  });
}

// @ts-expect-error - Deprecated OAuth function kept for reference
async function fetchCachedCredentials(): Promise<
  Credentials | null
> {
  const useEncryptedStorage = getUseEncryptedStorageFlag();
  if (useEncryptedStorage) {
    return await OAuthCredentialStorage.loadCredentials();
  }

  const pathsToTry = [
    Storage.getOAuthCredsPath(),
    process.env['GOOGLE_APPLICATION_CREDENTIALS'],
  ].filter((p): p is string => !!p);

  for (const keyFile of pathsToTry) {
    try {
      const keyFileString = await fs.readFile(keyFile, 'utf-8');
      return JSON.parse(keyFileString);
    } catch (error) {
      // Log specific error for debugging, but continue trying other paths
      debugLogger.debug(
        `Failed to load credentials from ${keyFile}:`,
        getErrorMessage(error),
      );
    }
  }

  return null;
}

// @ts-expect-error - Deprecated OAuth function kept for reference
async function cacheCredentials(credentials: Credentials) {
  const filePath = Storage.getOAuthCredsPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  const credString = JSON.stringify(credentials, null, 2);
  await fs.writeFile(filePath, credString, { mode: 0o600 });
  try {
    await fs.chmod(filePath, 0o600);
  } catch {
    /* empty */
  }
}

export function clearOauthClientCache() {
  oauthClientPromises.clear();
}

export async function clearCachedCredentialFile() {
  try {
    const useEncryptedStorage = getUseEncryptedStorageFlag();
    if (useEncryptedStorage) {
      await OAuthCredentialStorage.clearCredentials();
    } else {
      await fs.rm(Storage.getOAuthCredsPath(), { force: true });
    }
    // Clear the Google Account ID cache when credentials are cleared
    await userAccountManager.clearCachedGoogleAccount();
    // Clear the in-memory OAuth client cache to force re-authentication
    clearOauthClientCache();
  } catch (e) {
    debugLogger.warn('Failed to clear cached credentials:', e);
  }
}

async function fetchAndCacheUserInfo(client: OAuth2Client): Promise<void> {
  try {
    const { token } = await client.getAccessToken();
    if (!token) {
      return;
    }

    const response = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      debugLogger.log(
        'Failed to fetch user info:',
        response.status,
        response.statusText,
      );
      return;
    }

    const userInfo = await response.json();
    await userAccountManager.cacheGoogleAccount(userInfo.email);
  } catch (error) {
    debugLogger.log('Error retrieving user info:', error);
  }
}

// Helper to ensure test isolation
export function resetOauthClientForTesting() {
  oauthClientPromises.clear();
}
