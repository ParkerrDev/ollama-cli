/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useCallback, useContext, useMemo, useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import {
  DEFAULT_OLLAMA_FLASH_LITE_MODEL,
  DEFAULT_OLLAMA_FLASH_MODEL,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_OLLAMA_MODEL_AUTO,
  ModelSlashCommandEvent,
  logModelSlashCommand,
  OllamaModelClient,
  type OllamaModel,
} from '@google/ollama-cli-core';
import { useKeypress } from '../hooks/useKeypress.js';
import { theme } from '../semantic-colors.js';
import { DescriptiveRadioButtonSelect } from './shared/DescriptiveRadioButtonSelect.js';
import { ConfigContext } from '../contexts/ConfigContext.js';

interface ModelDialogProps {
  onClose: () => void;
}

interface ModelOption {
  value: string;
  title: string;
  description: string;
  key: string;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

const DEFAULT_MODEL_OPTIONS: ModelOption[] = [
  {
    value: DEFAULT_OLLAMA_MODEL_AUTO,
    title: 'Auto (recommended)',
    description: 'Let the system choose the best model for your task',
    key: 'default-auto',
  },
  {
    value: DEFAULT_OLLAMA_MODEL,
    title: 'Pro',
    description: 'For complex tasks that require deep reasoning and creativity',
    key: 'default-pro',
  },
  {
    value: DEFAULT_OLLAMA_FLASH_MODEL,
    title: 'Flash',
    description: 'For tasks that need a balance of speed and reasoning',
    key: 'default-flash',
  },
  {
    value: DEFAULT_OLLAMA_FLASH_LITE_MODEL,
    title: 'Flash-Lite',
    description: 'For simple tasks that need to be done quickly',
    key: 'default-flash-lite',
  },
];

export function ModelDialog({ onClose }: ModelDialogProps): React.JSX.Element {
  const config = useContext(ConfigContext);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>(DEFAULT_MODEL_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch available Ollama models
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const baseUrl = process.env['OLLAMA_BASE_URL'] || 'http://localhost:11434';
        const client = new OllamaModelClient(baseUrl);
        const models = await client.listModels();

        if (models.length > 0) {
          // Convert Ollama models to ModelOption format
          const ollamaOptions: ModelOption[] = models.map((model: OllamaModel, index: number) => ({
            value: model.name,
            title: model.name,
            description: model.details?.family 
              ? `${model.details.family} - ${formatBytes(model.size)}`
              : `Size: ${formatBytes(model.size)}`,
            key: `${model.name}-${model.digest.substring(0, 8)}-${index}`, // Use digest prefix and index for uniqueness
          }));

          setModelOptions(ollamaOptions);
        }
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch Ollama models:', err);
        setError('Could not connect to Ollama server. Using default models.');
        setLoading(false);
        // Keep using DEFAULT_MODEL_OPTIONS as fallback
      }
    };

    fetchModels();
  }, []);

  // Determine the Preferred Model (read once when the dialog opens).
  const preferredModel = config?.getModel() || DEFAULT_OLLAMA_MODEL_AUTO;

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onClose();
      }
    },
    { isActive: true },
  );

  // Calculate the initial index based on the preferred model.
  const initialIndex = useMemo(
    () => modelOptions.findIndex((option: ModelOption) => option.value === preferredModel),
    [preferredModel, modelOptions],
  );

  // Handle selection internally (Autonomous Dialog).
  const handleSelect = useCallback(
    (model: string) => {
      if (config) {
        config.setModel(model);
        const event = new ModelSlashCommandEvent(model);
        logModelSlashCommand(config, event);
      }
      onClose();
    },
    [config, onClose],
  );

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border.default}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>Select Model</Text>
      
      {loading && (
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>Loading models from Ollama...</Text>
        </Box>
      )}
      
      {error && (
        <Box marginTop={1}>
          <Text color={theme.status.warning}>{error}</Text>
        </Box>
      )}
      
      {!loading && (
        <Box marginTop={1}>
          <DescriptiveRadioButtonSelect
            items={modelOptions}
            onSelect={handleSelect}
            initialIndex={initialIndex}
            showNumbers={true}
          />
        </Box>
      )}
      
      <Box flexDirection="column">
        <Text color={theme.text.secondary}>
          {'> To use a specific Ollama model on startup, use the --model flag.'}
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.text.secondary}>(Press Esc to close)</Text>
      </Box>
    </Box>
  );
}
