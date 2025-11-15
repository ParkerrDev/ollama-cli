/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Text, useIsScreenReaderEnabled } from 'ink';
import { CliSpinner } from './CliSpinner.js';
import type { SpinnerName } from 'cli-spinners';
import { useStreamingContext } from '../contexts/StreamingContext.js';
import { StreamingState } from '../types.js';
import {
  SCREEN_READER_LOADING,
  SCREEN_READER_RESPONDING,
} from '../textConstants.js';
import { theme } from '../semantic-colors.js';

interface OllamaRespondingSpinnerProps {
  /**
   * Optional string to display when not in Responding state.
   * If not provided and not Responding, renders null.
   */
  nonRespondingDisplay?: string;
  spinnerType?: SpinnerName;
}

export const OllamaRespondingSpinner: React.FC<
  OllamaRespondingSpinnerProps
> = ({ nonRespondingDisplay, spinnerType = 'dots' }) => {
  const streamingState = useStreamingContext();
  const isScreenReaderEnabled = useIsScreenReaderEnabled();
  if (streamingState === StreamingState.Responding) {
    return (
      <OllamaSpinner
        spinnerType={spinnerType}
        altText={SCREEN_READER_RESPONDING}
      />
    );
  } else if (nonRespondingDisplay) {
    return isScreenReaderEnabled ? (
      <Text>{SCREEN_READER_LOADING}</Text>
    ) : (
      <Text color={theme.text.primary}>{nonRespondingDisplay}</Text>
    );
  }
  return null;
};

interface OllamaSpinnerProps {
  spinnerType?: SpinnerName;
  altText?: string;
}

export const OllamaSpinner: React.FC<OllamaSpinnerProps> = ({
  spinnerType = 'dots',
  altText,
}) => {
  const isScreenReaderEnabled = useIsScreenReaderEnabled();
  return isScreenReaderEnabled ? (
    <Text>{altText}</Text>
  ) : (
    <Text color={theme.text.primary}>
      <CliSpinner type={spinnerType} />
    </Text>
  );
};
