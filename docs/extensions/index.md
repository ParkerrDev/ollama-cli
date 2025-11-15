# Ollama CLI Extensions

_This documentation is up-to-date with the v0.4.0 release._

Ollama CLI extensions package prompts, MCP servers, and custom commands into a
familiar and user-friendly format. With extensions, you can expand the
capabilities of Ollama CLI and share those capabilities with others. They are
designed to be easily installable and shareable.

To see examples of extensions, you can browse a gallery of
[Ollama CLI extensions](https://ollamacli.com/extensions/browse/).

See [getting started docs](getting-started-extensions.md) for a guide on
creating your first extension.

See [releasing docs](extension-releasing.md) for an advanced guide on setting up
GitHub releases.

## Extension management

We offer a suite of extension management tools using `ollama extensions`
commands.

Note that these commands are not supported from within the CLI, although you can
list installed extensions using the `/extensions list` subcommand.

Note that all of these commands will only be reflected in active CLI sessions on
restart.

### Installing an extension

You can install an extension using `ollama extensions install` with either a
GitHub URL or a local path.

Note that we create a copy of the installed extension, so you will need to run
`ollama extensions update` to pull in changes from both locally-defined
extensions and those on GitHub.

NOTE: If you are installing an extension from GitHub, you'll need to have `git`
installed on your machine. See
[git installation instructions](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
for help.

```
ollama extensions install <source> [--ref <ref>] [--auto-update] [--pre-release] [--consent]
```

- `<source>`: The github URL or local path of the extension to install.
- `--ref`: The git ref to install from.
- `--auto-update`: Enable auto-update for this extension.
- `--pre-release`: Enable pre-release versions for this extension.
- `--consent`: Acknowledge the security risks of installing an extension and
  skip the confirmation prompt.

### Uninstalling an extension

To uninstall, run `ollama extensions uninstall <name>`:

```
ollama extensions uninstall ollama-cli-security
```

### Disabling an extension

Extensions are, by default, enabled across all workspaces. You can disable an
extension entirely or for specific workspace.

```
ollama extensions disable <name> [--scope <scope>]
```

- `<name>`: The name of the extension to disable.
- `--scope`: The scope to disable the extension in (`user` or `workspace`).

### Enabling an extension

You can enable extensions using `ollama extensions enable <name>`. You can also
enable an extension for a specific workspace using
`ollama extensions enable <name> --scope=workspace` from within that workspace.

```
ollama extensions enable <name> [--scope <scope>]
```

- `<name>`: The name of the extension to enable.
- `--scope`: The scope to enable the extension in (`user` or `workspace`).

### Updating an extension

For extensions installed from a local path or a git repository, you can
explicitly update to the latest version (as reflected in the
`ollama-extension.json` `version` field) with `ollama extensions update <name>`.

You can update all extensions with:

```
ollama extensions update --all
```

### Create a boilerplate extension

We offer several example extensions `context`, `custom-commands`,
`exclude-tools` and `mcp-server`. You can view these examples
[here](https://github.com/google-ollama/ollama-cli/tree/main/packages/cli/src/commands/extensions/examples).

To copy one of these examples into a development directory using the type of
your choosing, run:

```
ollama extensions new <path> [template]
```

- `<path>`: The path to create the extension in.
- `[template]`: The boilerplate template to use.

### Link a local extension

The `ollama extensions link` command will create a symbolic link from the
extension installation directory to the development path.

This is useful so you don't have to run `ollama extensions update` every time
you make changes you'd like to test.

```
ollama extensions link <path>
```

- `<path>`: The path of the extension to link.

## How it works

On startup, Ollama CLI looks for extensions in `<home>/.ollama/extensions`

Extensions exist as a directory that contains a `ollama-extension.json` file.
For example:

`<home>/.ollama/extensions/my-extension/ollama-extension.json`

### `ollama-extension.json`

The `ollama-extension.json` file contains the configuration for the extension.
The file has the following structure:

```json
{
  "name": "my-extension",
  "version": "1.0.0",
  "mcpServers": {
    "my-server": {
      "command": "node my-server.js"
    }
  },
  "contextFileName": "OLLAMA.md",
  "excludeTools": ["run_shell_command"]
}
```

- `name`: The name of the extension. This is used to uniquely identify the
  extension and for conflict resolution when extension commands have the same
  name as user or project commands. The name should be lowercase or numbers and
  use dashes instead of underscores or spaces. This is how users will refer to
  your extension in the CLI. Note that we expect this name to match the
  extension directory name.
- `version`: The version of the extension.
- `mcpServers`: A map of MCP servers to configure. The key is the name of the
  server, and the value is the server configuration. These servers will be
  loaded on startup just like MCP servers configured in a
  [`settings.json` file](../get-started/configuration.md). If both an extension
  and a `settings.json` file configure an MCP server with the same name, the
  server defined in the `settings.json` file takes precedence.
  - Note that all MCP server configuration options are supported except for
    `trust`.
- `contextFileName`: The name of the file that contains the context for the
  extension. This will be used to load the context from the extension directory.
  If this property is not used but a `OLLAMA.md` file is present in your
  extension directory, then that file will be loaded.
- `excludeTools`: An array of tool names to exclude from the model. You can also
  specify command-specific restrictions for tools that support it, like the
  `run_shell_command` tool. For example,
  `"excludeTools": ["run_shell_command(rm -rf)"]` will block the `rm -rf`
  command. Note that this differs from the MCP server `excludeTools`
  functionality, which can be listed in the MCP server config.

When Ollama CLI starts, it loads all the extensions and merges their
configurations. If there are any conflicts, the workspace configuration takes
precedence.

### Settings

_Note: This is an experimental feature. We do not yet recommend extension
authors introduce settings as part of their core flows._

Extensions can define settings that the user will be prompted to provide upon
installation. This is useful for things like API keys, URLs, or other
configuration that the extension needs to function.

To define settings, add a `settings` array to your `ollama-extension.json` file.
Each object in the array should have the following properties:

- `name`: A user-friendly name for the setting.
- `description`: A description of the setting and what it's used for.
- `envVar`: The name of the environment variable that the setting will be stored
  as.
- `sensitive`: Optional boolean. If true, obfuscates the input the user provides
  and stores the secret in keychain storage. **Example**

```json
{
  "name": "my-api-extension",
  "version": "1.0.0",
  "settings": [
    {
      "name": "API Key",
      "description": "Your API key for the service.",
      "envVar": "MY_API_KEY"
    }
  ]
}
```

When a user installs this extension, they will be prompted to enter their API
key. The value will be saved to a `.env` file in the extension's directory
(e.g., `<home>/.ollama/extensions/my-api-extension/.env`).

### Custom commands

Extensions can provide [custom commands](../cli/custom-commands.md) by placing
TOML files in a `commands/` subdirectory within the extension directory. These
commands follow the same format as user and project custom commands and use
standard naming conventions.

**Example**

An extension named `gcp` with the following structure:

```
.ollama/extensions/gcp/
├── ollama-extension.json
└── commands/
    ├── deploy.toml
    └── gcs/
        └── sync.toml
```

Would provide these commands:

- `/deploy` - Shows as `[gcp] Custom command from deploy.toml` in help
- `/gcs:sync` - Shows as `[gcp] Custom command from sync.toml` in help

### Conflict resolution

Extension commands have the lowest precedence. When a conflict occurs with user
or project commands:

1. **No conflict**: Extension command uses its natural name (e.g., `/deploy`)
2. **With conflict**: Extension command is renamed with the extension prefix
   (e.g., `/gcp.deploy`)

For example, if both a user and the `gcp` extension define a `deploy` command:

- `/deploy` - Executes the user's deploy command
- `/gcp.deploy` - Executes the extension's deploy command (marked with `[gcp]`
  tag)

## Variables

Ollama CLI extensions allow variable substitution in `ollama-extension.json`.
This can be useful if e.g., you need the current directory to run an MCP server
using `"cwd": "${extensionPath}${/}run.ts"`.

**Supported variables:**

| variable                   | description                                                                                                                                                     |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `${extensionPath}`         | The fully-qualified path of the extension in the user's filesystem e.g., '/Users/username/.ollama/extensions/example-extension'. This will not unwrap symlinks. |
| `${workspacePath}`         | The fully-qualified path of the current workspace.                                                                                                              |
| `${/} or ${pathSeparator}` | The path separator (differs per OS).                                                                                                                            |
