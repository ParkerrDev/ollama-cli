# Welcome to Ollama CLI documentation

This documentation provides a comprehensive guide to installing, using, and
developing Ollama CLI. This tool lets you interact with Ollama models through a
command-line interface.

## Overview

Ollama CLI brings the capabilities of Ollama models to your terminal in an
interactive Read-Eval-Print Loop (REPL) environment. Ollama CLI consists of a
client-side application (`packages/cli`) that communicates with a local server
(`packages/core`), which in turn manages requests to the Ollama API and its AI
models. Ollama CLI also contains a variety of tools for tasks such as performing
file system operations, running shells, and web fetching, which are managed by
`packages/core`.

## Navigating the documentation

This documentation is organized into the following sections:

### Get started

- **[Ollama CLI Quickstart](./get-started/index.md):** Let's get started with
  Ollama CLI.
- **[Installation](./get-started/installation.md):** Install and run Ollama CLI.
- **[Authentication](./get-started/authentication.md):** Authenticate Ollama
  CLI.
- **[Configuration](./get-started/configuration.md):** Information on
  configuring the CLI.
- **[Examples](./get-started/examples.md):** Example usage of Ollama CLI.

### CLI

- **[CLI overview](./cli/index.md):** Overview of the command-line interface.
- **[Commands](./cli/commands.md):** Description of available CLI commands.
- **[Enterprise](./cli/enterprise.md):** Ollama CLI for enterprise.
- **[Themes](./cli/themes.md):** Themes for Ollama CLI.
- **[Token Caching](./cli/token-caching.md):** Token caching and optimization.
- **[Tutorials](./cli/tutorials.md):** Tutorials for Ollama CLI.
- **[Checkpointing](./cli/checkpointing.md):** Documentation for the
  checkpointing feature.
- **[Telemetry](./cli/telemetry.md):** Overview of telemetry in the CLI.
- **[Trusted Folders](./cli/trusted-folders.md):** An overview of the Trusted
  Folders security feature.

### Core

- **[Ollama CLI core overview](./core/index.md):** Information about Ollama CLI
  core.
- **[Memport](./core/memport.md):** Using the Memory Import Processor.
- **[Tools API](./core/tools-api.md):** Information on how the core manages and
  exposes tools.
- **[Policy Engine](./core/policy-engine.md):** Use the Policy Engine for
  fine-grained control over tool execution.

### Tools

- **[Ollama CLI tools overview](./tools/index.md):** Information about Ollama
  CLI's tools.
- **[File System Tools](./tools/file-system.md):** Documentation for the
  `read_file` and `write_file` tools.
- **[MCP servers](./tools/mcp-server.md):** Using MCP servers with Ollama CLI.
- **[Shell Tool](./tools/shell.md):** Documentation for the `run_shell_command`
  tool.
- **[Web Fetch Tool](./tools/web-fetch.md):** Documentation for the `web_fetch`
  tool.
- **[Web Search Tool](./tools/web-search.md):** Documentation for the
  `google_web_search` tool.
- **[Memory Tool](./tools/memory.md):** Documentation for the `save_memory`
  tool.
- **[Todo Tool](./tools/todos.md):** Documentation for the `write_todos` tool.

### Extensions

- **[Extensions](./extensions/index.md):** How to extend the CLI with new
  functionality.
- **[Get Started with Extensions](./extensions/getting-started-extensions.md):**
  Learn how to build your own extension.
- **[Extension Releasing](./extensions/extension-releasing.md):** How to release
  Ollama CLI extensions.

### IDE integration

- **[IDE Integration](./ide-integration/index.md):** Connect the CLI to your
  editor.
- **[IDE Companion Extension Spec](./ide-integration/ide-companion-spec.md):**
  Spec for building IDE companion extensions.

### About the Ollama CLI project

- **[Architecture Overview](./architecture.md):** Understand the high-level
  design of Ollama CLI, including its components and how they interact.
- **[Contributing & Development Guide](../CONTRIBUTING.md):** Information for
  contributors and developers, including setup, building, testing, and coding
  conventions.
- **[NPM](./npm.md):** Details on how the project's packages are structured.
- **[Troubleshooting Guide](./troubleshooting.md):** Find solutions to common
  problems.
- **[FAQ](./faq.md):** Frequently asked questions.
- **[Terms of Service and Privacy Notice](./tos-privacy.md):** Information on
  the terms of service and privacy notices applicable to your use of Ollama CLI.
- **[Releases](./releases.md):** Information on the project's releases and
  deployment cadence.

We hope this documentation helps you make the most of Ollama CLI!
