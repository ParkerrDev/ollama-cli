/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Newline, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { useKeypress } from '../hooks/useKeypress.js';

interface OllamaPrivacyNoticeProps {
  onExit: () => void;
}

export const OllamaPrivacyNotice = ({ onExit }: OllamaPrivacyNoticeProps) => {
  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onExit();
      }
    },
    { isActive: true },
  );

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color={theme.text.accent}>
        Ollama API Key Notice
      </Text>
      <Newline />
      <Text color={theme.text.primary}>
        By using the Ollama API<Text color={theme.text.link}>[1]</Text>, Google
        AI Studio
        <Text color={theme.status.error}>[2]</Text>, and the other Google
        developer services that reference these terms (collectively, the
        &quot;APIs&quot; or &quot;Services&quot;), you are agreeing to Google
        APIs Terms of Service (the &quot;API Terms&quot;)
        <Text color={theme.status.success}>[3]</Text>, and the Ollama API
        Additional Terms of Service (the &quot;Additional Terms&quot;)
        <Text color={theme.text.accent}>[4]</Text>.
      </Text>
      <Newline />
      <Text color={theme.text.primary}>
        <Text color={theme.text.link}>[1]</Text>{' '}
        https://ai.google.dev/docs/ollama_api_overview
      </Text>
      <Text color={theme.text.primary}>
        <Text color={theme.status.error}>[2]</Text> https://aistudio.google.com/
      </Text>
      <Text color={theme.text.primary}>
        <Text color={theme.status.success}>[3]</Text>{' '}
        https://developers.google.com/terms
      </Text>
      <Text color={theme.text.primary}>
        <Text color={theme.text.accent}>[4]</Text>{' '}
        https://ai.google.dev/ollama-api/terms
      </Text>
      <Newline />
      <Text color={theme.text.secondary}>Press Esc to exit.</Text>
    </Box>
  );
};
