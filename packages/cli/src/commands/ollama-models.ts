/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  OllamaModelClient,
  formatBytes,
  formatRelativeTime,
} from '@google/ollama-cli-core';

/**
 * List all locally available Ollama models
 */
export async function listOllamaModels(baseUrl?: string): Promise<void> {
  const client = new OllamaModelClient(baseUrl);

  try {
    // Check if server is running
    const isRunning = await client.ping();
    if (!isRunning) {
      console.error('✗ Ollama server is not running');
      console.log('Start it with: ollama serve');
      process.exit(1);
    }

    const models = await client.listModels();

    if (models.length === 0) {
      console.log('No models found.');
      console.log('\nTo pull a model, run: ollama pull <model-name>');
      console.log('For example: ollama pull qwen2.5-coder:latest');
      return;
    }

    console.log('\n📦 Available Models:\n');
    console.log('NAME'.padEnd(35) + 'SIZE'.padEnd(15) + 'MODIFIED');
    console.log('─'.repeat(70));

    for (const model of models) {
      const name = model.name.padEnd(35);
      const size = formatBytes(model.size).padEnd(15);
      const modified = formatRelativeTime(model.modified_at);
      console.log(`${name}${size}${modified}`);
    }

    console.log(`\n✓ Total: ${models.length} model(s)\n`);
  } catch (error) {
    console.error(`✗ Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * List currently running Ollama models
 */
export async function listRunningModels(baseUrl?: string): Promise<void> {
  const client = new OllamaModelClient(baseUrl);

  try {
    const models = await client.listRunningModels();

    if (models.length === 0) {
      console.log('No models currently running.');
      return;
    }

    console.log('\n🔄 Running Models:\n');
    console.log('NAME'.padEnd(35) + 'SIZE'.padEnd(15) + 'VRAM');
    console.log('─'.repeat(70));

    for (const model of models) {
      const name = model.name.padEnd(35);
      const size = formatBytes(model.size).padEnd(15);
      const vram = formatBytes(model.size_vram);
      console.log(`${name}${size}${vram}`);
    }

    console.log(`\n✓ Total: ${models.length} running model(s)\n`);
  } catch (error) {
    console.error(`✗ Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * Show detailed information about a model
 */
export async function showModelInfo(modelName: string, baseUrl?: string): Promise<void> {
  const client = new OllamaModelClient(baseUrl);

  try {
    const info = await client.showModel(modelName);

    console.log(`\n📋 Model: ${modelName}\n`);
    console.log('Details:');
    console.log(`  Format: ${info.details.format}`);
    console.log(`  Family: ${info.details.family}`);
    console.log(`  Parameter Size: ${info.details.parameter_size}`);
    console.log(`  Quantization: ${info.details.quantization_level}`);
    
    if (info.details.parent_model) {
      console.log(`  Parent Model: ${info.details.parent_model}`);
    }

    console.log('\nParameters:');
    console.log(info.parameters);

    console.log('\nTemplate:');
    console.log(info.template.substring(0, 200) + (info.template.length > 200 ? '...' : ''));
    console.log();
  } catch (error) {
    console.error(`✗ Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * Pull a model from the registry
 */
export async function pullModel(modelName: string, baseUrl?: string): Promise<void> {
  const client = new OllamaModelClient(baseUrl);

  console.log(`\n📥 Pulling model: ${modelName}\n`);

  try {
    let lastStatus = '';
    await client.pullModel(modelName, progress => {
      if (progress.status !== lastStatus) {
        console.log(`${progress.status}`);
        lastStatus = progress.status;
      }
      
      if (progress.total && progress.completed) {
        const percent = ((progress.completed / progress.total) * 100).toFixed(1);
        process.stdout.write(`\r${progress.status}: ${percent}%`);
      }
    });

    console.log(`\n\n✓ Successfully pulled ${modelName}\n`);
  } catch (error) {
    console.error(`\n✗ Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * Delete a model
 */
export async function deleteModel(modelName: string, baseUrl?: string): Promise<void> {
  const client = new OllamaModelClient(baseUrl);

  try {
    await client.deleteModel(modelName);
    console.log(`✓ Successfully deleted model: ${modelName}`);
  } catch (error) {
    console.error(`✗ Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * Copy a model
 */
export async function copyModel(
  source: string,
  destination: string,
  baseUrl?: string,
): Promise<void> {
  const client = new OllamaModelClient(baseUrl);

  try {
    await client.copyModel(source, destination);
    console.log(`✓ Successfully copied ${source} to ${destination}`);
  } catch (error) {
    console.error(`✗ Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
