/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { TextInput } from '../components/shared/TextInput.js';
import { useTextBuffer } from '../components/shared/text-buffer.js';
import { useUIState } from '../contexts/UIStateContext.js';

interface ApiAuthDialogProps {
  onSubmit: (serverUrl: string) => void;
  onCancel: () => void;
  error?: string | null;
  defaultValue?: string;
}

export function ApiAuthDialog({
  onSubmit,
  onCancel,
  error,
  defaultValue = 'http://localhost:11434',
}: ApiAuthDialogProps): React.JSX.Element {
  const { mainAreaWidth } = useUIState();
  const viewportWidth = mainAreaWidth - 8;

  const buffer = useTextBuffer({
    initialText: defaultValue || 'http://localhost:11434',
    initialCursorOffset: defaultValue?.length || 'http://localhost:11434'.length,
    viewport: {
      width: viewportWidth,
      height: 4,
    },
    isValidPath: () => false, // No path validation needed for server URL
    inputFilter: (text) => text.replace(/[\r\n]/g, ''),
    singleLine: true,
  });

  const handleSubmit = (value: string) => {
    onSubmit(value);
  };

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border.focused}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold color={theme.text.primary}>
        Configure Ollama Server
      </Text>
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.text.primary}>
          Please enter the URL of your Ollama server. This will be saved in your
          settings.
        </Text>
        <Text color={theme.text.secondary}>
          Default: http://localhost:11434 (if Ollama is running locally)
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="row">
        <Box
          borderStyle="round"
          borderColor={theme.border.default}
          paddingX={1}
          flexGrow={1}
        >
          <TextInput
            buffer={buffer}
            onSubmit={handleSubmit}
            onCancel={onCancel}
            placeholder="http://localhost:11434"
          />
        </Box>
      </Box>
      {error && (
        <Box marginTop={1}>
          <Text color={theme.status.error}>{error}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text color={theme.text.secondary}>
          (Press Enter to submit, Esc to cancel)
        </Text>
      </Box>
    </Box>
  );
}
